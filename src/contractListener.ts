import { TransactionReceipt, ethers } from 'ethers';
import { Erc20Token } from './types';
import axios from 'axios';

const erc20Abi = [
    // Minimal ERC-20 ABI
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint256)"
];

class ContractCreationListener {
    private provider: ethers.Provider;
    private running: boolean;
    private blockHandler: (blockNumber: number) => Promise<void>;
    private rpcEndpoints: string[];
    private currentRpcIndex: number;

    constructor(providerUrl: string, rpcEndpoints: string[]) {
        this.provider = new ethers.JsonRpcProvider(providerUrl);
        this.running = false;
        this.rpcEndpoints = rpcEndpoints;
        this.currentRpcIndex = 0;

        this.blockHandler = async (blockNumber: number) => {
            console.log(`New block: ${blockNumber}`);
            try {
                const block = await this.provider.getBlock(blockNumber);
                if (block) {
                    const txs = await Promise.all(block.transactions.map(hash => this.provider.getTransaction(hash)));
                    for (const tx of txs) {
                        if (tx && !tx.to) {
                            const receipt = await this.provider.getTransactionReceipt(tx.hash);
                            if (receipt && receipt.contractAddress) {
                                console.log(`New contract created at address: ${receipt.contractAddress}`);
                                await this.processContract(receipt);
                            }
                        }
                    }
                }
            } catch (error) {
                await this.switchRpcEndpoint();
            }
        };
    }

    private async switchRpcEndpoint(): Promise<void> {
        this.currentRpcIndex = (this.currentRpcIndex + 1) % this.rpcEndpoints.length;
        const newRpcUrl = this.rpcEndpoints[this.currentRpcIndex];
        console.log(`Switching RPC endpoint to: ${newRpcUrl}`);
        this.provider = new ethers.JsonRpcProvider(newRpcUrl);
    }

    public start(): void {
        if (!this.running) {
            this.running = true;
            this.provider.on('block', this.blockHandler);
            console.log('Listener started.');
        }
    }

    public stop(): void {
        if (this.running) {
            this.running = false;
            this.provider.off('block', this.blockHandler);
            console.log('Listener stopped.');
        }
    }

    public async checkBlock(blockNumber: number): Promise<void> {
        await this.blockHandler(blockNumber);
    }

    private async processContract(receipt: TransactionReceipt): Promise<void> {
        try {
            // Check if the contract conforms to ERC-20, and if so, get relevant information
            const contract = new ethers.Contract(receipt.contractAddress ?? "", erc20Abi, this.provider);

            const totalSupplyRaw = await contract.totalSupply();
            const decimals = await contract.decimals();

            // Convert to BigInt and adjust for decimals
            const totalSupply = BigInt(totalSupplyRaw.toString());
            const adjustedTotalSupply = (totalSupply / BigInt(10) ** BigInt(decimals)).toString();

            const name = await contract.name();
            const symbol = await contract.symbol();

            // Make a GET request to the specified endpoint for each found contract
            const responseData = await this.fetchContractData(receipt.contractAddress ?? "");
            const foundContract: Erc20Token = {
                address: receipt.contractAddress ?? "",
                name: name,
                symbol: symbol,
                totalSupply: adjustedTotalSupply,
                decimals: decimals,
                deployer: receipt.from,
                response: responseData // Store response in found contract
            };
            console.log(foundContract);

            console.log("Safe Addresses:", foundContract.response.results.safe);
            console.log("Suspicious Addresses:", foundContract.response.results.suspicious);
            console.log("New Addresses:", foundContract.response.results.new);
            console.log("Failed Addresses:", foundContract.response.results.failed);

        } catch (error) {
            // If any of the operations fail, it may not be a valid ERC-20 contract at the time of deployment
            // Optionally log this error
            // console.error(`Error checking ERC-20 contract at address ${receipt.contractAddress ?? ""}:`, error);
        }
    }

    private async fetchContractData(contractAddress: string): Promise<any> {
        try {
            const url = `https://pulseapi.solodragonsden.cloud/basechain/selector/${contractAddress}`
            console.log(url)
            const response = await axios.get(url);
            return response.data;
        } catch (error) {
            console.error("Error fetching contract data:", error);
            return null;
        }
    }
}

const RPC_ENDPOINTS = [
    'https://base.blockpi.network/v1/rpc/public',
    'https://public.stackup.sh/api/v1/node/base-mainnet',
    'https://base-rpc.publicnode.com',
    'https://base.drpc.org',
    'https://1rpc.io/base',
    'https://base.meowrpc.com',
    'https://base.rpc.subquery.network/public',
    'https://base.gateway.tenderly.co',
    'https://developer-access-mainnet.base.org',
    'https://endpoints.omniatech.io/v1/base/mainnet/public'
];

const listener = new ContractCreationListener('https://mainnet.base.org', RPC_ENDPOINTS);
// Start listening to new blocks
listener.start();
