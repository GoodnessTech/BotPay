import { ethers } from 'ethers';
import contractConfig from '@/contracts/BotPayEscrow.json';

export const BOT_CHAIN = {
  chainId: Number(import.meta.env.VITE_BOT_CHAIN_ID) || 677,
  chainIdHex: '0x2a5',
  chainName: 'BOT Chain Mainnet',
  rpcUrl: (import.meta.env.VITE_BOT_CHAIN_RPC_URL as string) || 'https://rpc.botchain.ai',
  blockExplorer: (import.meta.env.VITE_BOT_CHAIN_EXPLORER_URL as string) || 'https://scan.botchain.ai',
  nativeCurrency: {
    name: 'BOT',
    symbol: 'BOT',
    decimals: 18,
  },
  contractAddress:
    (import.meta.env.VITE_BOTPAY_CONTRACT_ADDRESS as string) ||
    contractConfig.address ||
    '0x2d25345ff92C85E00E83c8ce1798f0CD66f6DCCA',
  abi: contractConfig.abi,
};

export enum AgreementStatus {
  None = 0,
  Funded = 1,
  Delivered = 2,
  Released = 3,
  Refunded = 4,
}

export const STATUS_MAP: Record<AgreementStatus, { label: string; accent: string }> = {
  [AgreementStatus.None]: { label: 'Empty', accent: 'muted' },
  [AgreementStatus.Funded]: { label: 'Awaiting Delivery', accent: 'yellow' },
  [AgreementStatus.Delivered]: { label: 'Review Window Active', accent: 'blue' },
  [AgreementStatus.Released]: { label: 'Payment Settled', accent: 'mint' },
  [AgreementStatus.Refunded]: { label: 'Escrow Refunded', accent: 'lavender' },
};

export interface OnChainAgreement {
  id: number;
  buyer: string;
  provider: string;
  amount: string;
  serviceDeadline: number;
  deliveryTimestamp: number;
  reviewDeadline: number;
  reviewDuration: number;
  deliveryEvidenceHash: string;
  status: AgreementStatus;
  statusLabel: string;
  accent: string;
}

export function getReadProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(BOT_CHAIN.rpcUrl);
}

export function getReadContract(): ethers.Contract {
  return new ethers.Contract(BOT_CHAIN.contractAddress, BOT_CHAIN.abi, getReadProvider());
}

export async function getBrowserSigner(): Promise<{ signer: ethers.Signer; address: string; chainId: number }> {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('No Web3 wallet detected. Please install MetaMask or another EVM wallet.');
  }

  const provider = new ethers.BrowserProvider((window as any).ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  const network = await provider.getNetwork();

  return { signer, address, chainId: Number(network.chainId) };
}

export async function switchToBotChain(): Promise<void> {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('No Web3 wallet detected.');
  }

  const eth = (window as any).ethereum;
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BOT_CHAIN.chainIdHex }],
    });
  } catch (switchError: any) {
    if (switchError.code === 4902 || switchError.data?.originalError?.code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BOT_CHAIN.chainIdHex,
            chainName: BOT_CHAIN.chainName,
            nativeCurrency: BOT_CHAIN.nativeCurrency,
            rpcUrls: [BOT_CHAIN.rpcUrl],
            blockExplorerUrls: [BOT_CHAIN.blockExplorer],
          },
        ],
      });
    } else {
      throw switchError;
    }
  }
}

export async function fetchLiveAgreementCount(): Promise<number> {
  try {
    const contract = getReadContract();
    const count = await contract.agreementCount();
    return Number(count);
  } catch (err) {
    console.warn('Failed to fetch agreement count:', err);
    return 0;
  }
}

export async function fetchAllAgreements(): Promise<OnChainAgreement[]> {
  try {
    const contract = getReadContract();
    const count = await contract.agreementCount();
    const total = Number(count);
    if (total === 0) return [];

    const list: OnChainAgreement[] = [];
    // Read most recent agreements (up to 20)
    const start = Math.max(1, total - 19);
    for (let id = total; id >= start; id--) {
      try {
        const ag = await contract.getAgreement(id);
        const status = Number(ag.status) as AgreementStatus;
        const meta = STATUS_MAP[status] || { label: 'Unknown', accent: 'muted' };
        list.push({
          id,
          buyer: ag.buyer,
          provider: ag.provider,
          amount: ethers.formatEther(ag.amount),
          serviceDeadline: Number(ag.serviceDeadline),
          deliveryTimestamp: Number(ag.deliveryTimestamp),
          reviewDeadline: Number(ag.reviewDeadline),
          reviewDuration: Number(ag.reviewDuration),
          deliveryEvidenceHash: ag.deliveryEvidenceHash,
          status,
          statusLabel: meta.label,
          accent: meta.accent,
        });
      } catch (e) {
        console.warn(`Error reading agreement ${id}:`, e);
      }
    }
    return list;
  } catch (err) {
    console.warn('Failed to fetch on-chain agreements:', err);
    return [];
  }
}

export async function getWalletBalance(address: string): Promise<string> {
  try {
    const provider = getReadProvider();
    const bal = await provider.getBalance(address);
    return ethers.formatEther(bal);
  } catch {
    return '0.0';
  }
}
