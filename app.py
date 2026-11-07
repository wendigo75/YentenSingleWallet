# ==========================================================================
# Yenten Single Wallet
# Copyright (c) 2026 wendigo75
# This file is part of the Yenten Single Wallet project.
# It is designed specifically to operate alongside the compiled executable. 
# You are free to use, modify, and distribute this software, provided that
# proper credit/mention is given to the original author in all
# copies or substantial portions of the software.
# This software is provided "AS IS", without warranty of any kind.
# For full license terms, see the LICENSE file in the root directory.
# ==========================================================================

import json
import logging
import re
import secrets
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen
from flask import Flask, jsonify, render_template, request
from werkzeug.serving import make_server
from version import APP_VERSION

app = Flask(__name__, template_folder='template', static_folder='static')
app.config['MAX_CONTENT_LENGTH'] = 300_000
app.config['YTN_LIVE_SEND_ENABLED'] = False
BROADCAST_CSRF_TOKEN = secrets.token_urlsafe(32)
YENTEN_BROADCAST_URL = 'https://api.yentencoin.info/broadcast'
class YentenAPIError(Exception):
    pass

@app.context_processor
def inject_wallet_send_config():
    return {
        'YTN_LIVE_SEND_ENABLED': app.config['YTN_LIVE_SEND_ENABLED'],
        'YTN_CSRF_TOKEN': BROADCAST_CSRF_TOKEN,
        'APP_VERSION': APP_VERSION,
    }
def fetch_yenten_result(path, timeout=10):
    api_url = 'https://api.yentencoin.info/' + path
    upstream_request = Request(
        api_url,
        headers={
            'Accept': 'application/json',
            'User-Agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/131.0.0.0 Safari/537.36'
            ),
        },
    )
    try:
        with urlopen(upstream_request, timeout=timeout) as response:
            api_response = json.loads(response.read().decode('utf-8'))
    except HTTPError as error:
        raise YentenAPIError(f'Yenten API returned HTTP {error.code}.') from error
    except (URLError, TimeoutError) as error:
        reason = error.reason if isinstance(error, URLError) else error
        raise YentenAPIError(f'Could not reach Yenten API: {reason}') from error
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise YentenAPIError('Yenten API returned invalid JSON.') from error

    if not isinstance(api_response, dict) or 'result' not in api_response:
        raise YentenAPIError('Yenten API returned an invalid response.')
    if api_response.get('error') is not None:
        raise YentenAPIError('Yenten API returned an error.')
    return api_response['result']
def _transaction_addresses(item):
    script = item.get('scriptPubKey')
    if not isinstance(script, dict):
        return []
    addresses = script.get('addresses')
    if isinstance(addresses, list):
        return addresses
    address = script.get('address')
    return [address] if isinstance(address, str) else []
def _transaction_value_satoshis(item):
    value = item.get('value')
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise YentenAPIError('Yenten API returned an invalid transaction value.')
    return value
def _normalize_transaction(txid, address, pending=False):
    transaction = fetch_yenten_result('transaction/' + quote(txid, safe=''), timeout=30)
    if not isinstance(transaction, dict):
        raise YentenAPIError('Yenten API returned invalid transaction details.')
    inputs = transaction.get('vin')
    outputs = transaction.get('vout')
    if not isinstance(inputs, list) or not isinstance(outputs, list):
        raise YentenAPIError('Yenten API returned invalid transaction inputs or outputs.')
    input_total = 0
    for tx_input in inputs:
        if not isinstance(tx_input, dict):
            raise YentenAPIError('Yenten API returned an invalid transaction input.')
        if address in _transaction_addresses(tx_input):
            input_total += _transaction_value_satoshis(tx_input)
    output_total = 0
    for tx_output in outputs:
        if not isinstance(tx_output, dict):
            raise YentenAPIError('Yenten API returned an invalid transaction output.')
        if address in _transaction_addresses(tx_output):
            output_total += _transaction_value_satoshis(tx_output)
    net_satoshis = output_total - input_total
    if net_satoshis > 0:
        direction = 'incoming'
    elif net_satoshis < 0:
        direction = 'outgoing'
    else:
        direction = 'neutral'
    timestamp = transaction.get('time', transaction.get('blocktime'))
    if isinstance(timestamp, bool) or not isinstance(timestamp, int) or timestamp <= 0:
        timestamp = None
    confirmations = transaction.get('confirmations', 0)
    if isinstance(confirmations, bool) or not isinstance(confirmations, int) or confirmations < 0:
        confirmations = 0
    amount = Decimal(abs(net_satoshis)) / Decimal(100_000_000)
    return {
        'txid': txid,
        'direction': direction,
        'amount': format(amount, '.8f'),
        'timestamp': timestamp,
        'confirmations': confirmations,
        'pending': pending,
    }

@app.route('/')
def home():
    return render_template('index.html')

@app.get('/api/balance')
def wallet_balance():
    address = request.args.get('address', '')
    if not re.fullmatch(r'Y[1-9A-HJ-NP-Za-km-z]{25,34}', address):
        return jsonify(error='Invalid Yenten address.'), 400
    api_url = (
        'https://api.yentencoin.info/balance/'
        + quote(address, safe='')
    )
    try:
        upstream_request = Request(
            api_url,
            headers={
                'Accept': 'application/json',
                'User-Agent': (
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                    'AppleWebKit/537.36 (KHTML, like Gecko) '
                    'Chrome/131.0.0.0 Safari/537.36'
                ),
            },
        )
        with urlopen(upstream_request, timeout=10) as response:
            api_response = json.loads(response.read().decode('utf-8'))
    except HTTPError as error:
        return jsonify(error=f'Yenten balance API returned HTTP {error.code}.'), 502
    except (URLError, TimeoutError) as error:
        return jsonify(error=f'Could not reach Yenten balance API: {error.reason if isinstance(error, URLError) else error}'), 502
    except (UnicodeDecodeError, json.JSONDecodeError):
        return jsonify(error='Yenten balance API returned an invalid response.'), 502

    if not isinstance(api_response, dict):
        return jsonify(error='Yenten balance API returned an invalid response.'), 502
    result = api_response.get('result')
    balance_satoshis = result.get('balance') if isinstance(result, dict) else None
    if (
        api_response.get('error') is not None
        or isinstance(balance_satoshis, bool)
        or not isinstance(balance_satoshis, int)
        or balance_satoshis < 0
    ):
        return jsonify(error='Yenten balance API returned an invalid balance.'), 502
    balance = Decimal(balance_satoshis) / Decimal(100_000_000)
    return jsonify(address=address, balance=format(balance, 'f'))

@app.get('/api/unspent')
def wallet_unspent_outputs():
    address = request.args.get('address', '')
    if not re.fullmatch(r'Y[1-9A-HJ-NP-Za-km-z]{25,34}', address):
        return jsonify(error='Invalid Yenten address.'), 400
    try:
        outputs = fetch_yenten_result('unspent/' + quote(address, safe=''))
        if not isinstance(outputs, list):
            raise YentenAPIError('Yenten API returned invalid unspent output data.')
        normalized_outputs = []
        total_satoshis = 0
        for output in outputs:
            if not isinstance(output, dict):
                raise YentenAPIError('Yenten API returned an invalid unspent output.')
            txid = output.get('txid')
            output_index = output.get('index')
            script = output.get('script')
            value = output.get('value')
            height = output.get('height')
            if (
                not isinstance(txid, str)
                or not re.fullmatch(r'[0-9a-fA-F]{64}', txid)
                or isinstance(output_index, bool)
                or not isinstance(output_index, int)
                or output_index < 0
                or not isinstance(script, str)
                or not re.fullmatch(r'(?:[0-9a-fA-F]{2})+', script)
                or isinstance(value, bool)
                or not isinstance(value, int)
                or value <= 0
                or isinstance(height, bool)
                or not isinstance(height, int)
                or height < 0
            ):
                raise YentenAPIError('Yenten API returned an invalid unspent output.')
            total_satoshis += value
            normalized_outputs.append({
                'txid': txid,
                'index': output_index,
                'script': script,
                'value_satoshis': str(value),
                'height': height,
            })
    except YentenAPIError as error:
        return jsonify(error=str(error)), 502
    return jsonify(
        address=address,
        count=len(normalized_outputs),
        total_satoshis=str(total_satoshis),
        outputs=normalized_outputs,
    )

@app.post('/api/broadcast')
def broadcast_wallet_transaction():
    if not app.config['YTN_LIVE_SEND_ENABLED']:
        return jsonify(error='Live transaction broadcast is disabled on this server.'), 503
    host_header = request.host
    host = (
        host_header[1:].split(']', 1)[0].lower()
        if host_header.startswith('[')
        else host_header.partition(':')[0].lower()
    )
    expected_origin = f'{request.scheme}://{request.host}'
    if (
        host not in {'localhost', '127.0.0.1', '::1'}
        or request.headers.get('Origin') != expected_origin
        or not secrets.compare_digest(
            request.headers.get('X-YTN-CSRF-Token', ''),
            BROADCAST_CSRF_TOKEN,
        )
        or not request.is_json
    ):
        return jsonify(error='Broadcast request failed local origin or CSRF validation.'), 403
    payload = request.get_json(silent=True)
    raw_transaction = payload.get('raw_transaction') if isinstance(payload, dict) else None
    if (
        not isinstance(raw_transaction, str)
        or len(raw_transaction) < 20
        or len(raw_transaction) > 250_000
        or len(raw_transaction) % 2 != 0
        or not re.fullmatch(r'[0-9a-fA-F]+', raw_transaction)
    ):
        return jsonify(error='A valid hex-encoded signed transaction is required.'), 400
    upstream_request = Request(
        YENTEN_BROADCAST_URL,
        data=urlencode({'raw': raw_transaction}).encode('ascii'),
        headers={
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Yenten-Webwallet-Local/1.0',
        },
        method='POST',
    )
    try:
        with urlopen(upstream_request, timeout=20) as response:
            api_response = json.loads(response.read().decode('utf-8'))
    except HTTPError as error:
        return jsonify(
            error=f'Yenten broadcast service returned HTTP {error.code}.',
            outcome_uncertain=True,
        ), 502
    except (URLError, TimeoutError) as error:
        reason = error.reason if isinstance(error, URLError) else error
        return jsonify(
            error=f'Could not confirm the broadcast result: {reason}',
            outcome_uncertain=True,
        ), 502
    except (UnicodeDecodeError, json.JSONDecodeError):
        return jsonify(
            error='Yenten broadcast service returned an invalid response.',
            outcome_uncertain=True,
        ), 502
    if not isinstance(api_response, dict):
        return jsonify(
            error='Yenten broadcast service returned an invalid response.',
            outcome_uncertain=True,
        ), 502
    rpc_error = api_response.get('error')
    if rpc_error is not None:
        if isinstance(rpc_error, dict):
            message = rpc_error.get('message')
            code = rpc_error.get('code')
        else:
            message = str(rpc_error)
            code = None
        if not isinstance(message, str) or not message:
            message = 'Yenten node rejected the transaction.'
        if isinstance(code, bool) or not isinstance(code, int):
            code = None
        return jsonify(
            error=message,
            outcome_uncertain=code not in {-22, -25, -26},
        ), 422
    transaction_id = api_response.get('result')
    if not isinstance(transaction_id, str) or not re.fullmatch(r'[0-9a-fA-F]{64}', transaction_id):
        return jsonify(
            error='Yenten broadcast service did not return a valid transaction ID.',
            outcome_uncertain=True,
        ), 502
    return jsonify(transaction_id=transaction_id.lower())

@app.get('/api/status')
def wallet_network_status():
    try:
        info = fetch_yenten_result('info')
    except YentenAPIError as error:
        return jsonify(error=str(error)), 502
    block_height = info.get('blocks') if isinstance(info, dict) else None
    if isinstance(block_height, bool) or not isinstance(block_height, int) or block_height < 0:
        return jsonify(error='Yenten API returned an invalid block height.'), 502
    return jsonify(block_height=block_height)

@app.get('/api/history')
def wallet_history():
    address = request.args.get('address', '')
    if not re.fullmatch(r'Y[1-9A-HJ-NP-Za-km-z]{25,34}', address):
        return jsonify(error='Invalid Yenten address.'), 400
    offset_text = request.args.get('offset', '0')
    if not re.fullmatch(r'\d+', offset_text):
        return jsonify(error='Offset must be a non-negative integer.'), 400
    offset = int(offset_text)
    if offset % 10 != 0:
        return jsonify(error='Offset must be a multiple of 10.'), 400

    try:
        history = fetch_yenten_result(
            'history/' + quote(address, safe='') + '?offset=' + str(offset)
        )
        if not isinstance(history, dict):
            raise YentenAPIError('Yenten API returned invalid history data.')
        txids = history.get('tx')
        txcount = history.get('txcount')
        if (
            not isinstance(txids, list)
            or isinstance(txcount, bool)
            or not isinstance(txcount, int)
            or txcount < 0
            or any(not isinstance(txid, str) or not re.fullmatch(r'[0-9a-fA-F]{64}', txid) for txid in txids)
        ):
            raise YentenAPIError('Yenten API returned invalid history data.')
        with ThreadPoolExecutor(max_workers=5) as executor:
            transactions = list(executor.map(
                lambda txid: _normalize_transaction(txid, address),
                txids
            ))
    except YentenAPIError as error:
        return jsonify(error=str(error)), 502
    return jsonify(
        address=address,
        offset=offset,
        txcount=txcount,
        transactions=transactions,
    )

@app.get('/api/history/mempool')
def wallet_mempool_history():
    address = request.args.get('address', '')
    if not re.fullmatch(r'Y[1-9A-HJ-NP-Za-km-z]{25,34}', address):
        return jsonify(error='Invalid Yenten address.'), 400
    try:
        mempool = fetch_yenten_result('mempool/' + quote(address, safe=''))
        if not isinstance(mempool, dict):
            raise YentenAPIError('Yenten API returned invalid mempool data.')
        entries = mempool.get('tx')
        txcount = mempool.get('txcount')
        if (
            not isinstance(entries, list)
            or isinstance(txcount, bool)
            or not isinstance(txcount, int)
            or txcount < 0
        ):
            raise YentenAPIError('Yenten API returned invalid mempool data.')
        txids = []
        seen_txids = set()
        for entry in entries:
            if not isinstance(entry, dict):
                raise YentenAPIError('Yenten API returned invalid mempool data.')
            txid = entry.get('txid')
            if not isinstance(txid, str) or not re.fullmatch(r'[0-9a-fA-F]{64}', txid):
                raise YentenAPIError('Yenten API returned invalid mempool data.')
            if txid not in seen_txids:
                seen_txids.add(txid)
                txids.append(txid)
        with ThreadPoolExecutor(max_workers=5) as executor:
            transactions = list(executor.map(
                lambda txid: _normalize_transaction(txid, address, pending=True),
                txids
            ))
    except YentenAPIError as error:
        return jsonify(error=str(error)), 502
    return jsonify(
        address=address,
        txcount=txcount,
        transactions=transactions,
    )
    
if __name__ == '__main__':
    app.config['YTN_LIVE_SEND_ENABLED'] = True
    logging.getLogger('werkzeug').setLevel(logging.ERROR)
    server = make_server('127.0.0.1', 5000, app, threaded=True)
    print('Yenten Web Wallet')
    print('Open this address in your browser: http://127.0.0.1:5000')
    print('Live transaction broadcasts are enabled after final confirmation.')
    print('Press Ctrl+C to stop the server.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nYenten Web Wallet stopped.')
    finally:
        server.server_close()