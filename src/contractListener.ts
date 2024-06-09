<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Base Block Listener</title>
</head>
<body>
    <h1>Base Block Listener</h1>
    <div id="block-container">
        <p>Waiting for new blocks...</p>
    </div>
    <div id="transactions-container">
        <h2>Transactions</h2>
        <ul id="transactions-list"></ul>
    </div>
    <!-- Add the on/off slider -->
    <div id="listener-control">
        <label for="listener-toggle">Listener:</label>
        <input type="checkbox" id="listener-toggle" checked>
    </div>

    <script>
        const RPC_ENDPOINTS = [
            'https://mainnet.base.org',
            'https://base.blockpi.network/v1/rpc/public',
            'https://public.stackup.sh/api/v1/node/base-mainnet',
            'https://base-rpc.publicnode.com',
            'https://base.drpc.org',
            'https://1rpc.io/base',
            'https://base.meowrpc.com',
            'https://base.rpc.subquery.network/public',
            'https://gateway.tenderly.co/public/base',
            'https://base.gateway.tenderly.co',
            'https://developer-access-mainnet.base.org',
            'https://endpoints.omniatech.io/v1/base/mainnet/public'
        ];
        
        let lastProcessedBlock = -1;
        let currentRpcIndex = 0;
        let pollingInterval;
        let processingBlock = false;

        function getNextRpcUrl() {
            currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
            return RPC_ENDPOINTS[currentRpcIndex];
        }

        async function fetchLatestBlock() {
            if (processingBlock) return; // Skip fetching if still processing
            const NODE_URL = getNextRpcUrl();
            try {
                const response = await fetch(NODE_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        method: "eth_blockNumber",
                        params: [],
                        id: 1
                    })
                });

                const data = await response.json();
                const latestBlock = parseInt(data.result, 16);

                if (latestBlock > lastProcessedBlock) {
                    processingBlock = true;
                    lastProcessedBlock = latestBlock;
                    document.getElementById('block-container').innerText = `Latest Block: ${latestBlock}`;
                    await fetchBlockDetails(`0x${latestBlock.toString(16)}`);
                    processingBlock = false;
                }
            } catch (error) {
                console.error('Error fetching latest block:', error);
                processingBlock = false;
            }
        }

        async function fetchBlockDetails(blockNumber) {
            const NODE_URL = getNextRpcUrl();
            try {
                const response = await fetch(NODE_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        method: "eth_getBlockByNumber",
                        params: [blockNumber, true], // 'true' to get full transaction objects
                        id: 1
                    })
                });

                const data = await response.json();
                const block = data.result;
                const transactions = block.transactions;
                await displayTransactions(transactions, block.number);
            } catch (error) {
                console.error('Error fetching block details:', error);
            }
        }

        async function fetchTransactionReceipts(transactionHashes) {
            const NODE_URL = getNextRpcUrl();
            try {
                const requests = transactionHashes.map(txHash => ({
                    jsonrpc: "2.0",
                    method: "eth_getTransactionReceipt",
                    params: [txHash],
                    id: txHash
                }));

                const response = await fetch(NODE_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requests)
                });

                const data = await response.json();
                return data.map(item => item.result);
            } catch (error) {
                console.error('Error fetching transaction receipts:', error);
                return [];
            }
        }

        async function displayTransactions(transactions, blockNumber) {
            const transactionsList = document.getElementById('transactions-list');
            const transactionHashes = transactions.map(tx => tx.hash);

            const receipts = await fetchTransactionReceipts(transactionHashes);

            for (let i = 0; i < transactions.length; i++) {
                const tx = transactions[i];
                const receipt = receipts[i];
                const listItem = document.createElement('li');
                listItem.textContent = `Block: ${parseInt(blockNumber, 16)}, Tx Hash: ${tx.hash}`;
                transactionsList.appendChild(listItem);

                if (receipt && receipt.contractAddress !== null) {
                    const receiptItem = document.createElement('pre'); // Use <pre> for displaying raw JSON
                    receiptItem.textContent = JSON.stringify(receipt, null, 2); // Stringify the receipt with formatting
                    listItem.appendChild(receiptItem);
                }
            }
        }

        function toggleListener() {
            const listenerToggle = document.getElementById('listener-toggle');
            if (listenerToggle.checked) {
                pollingInterval = setInterval(fetchLatestBlock, 1000);
            } else {
                clearInterval(pollingInterval);
            }
        }

        // Start polling initially
        toggleListener();

        // Attach event listener to toggle button
        document.getElementById('listener-toggle').addEventListener('change', toggleListener);
    </script>
</body>
</html>
