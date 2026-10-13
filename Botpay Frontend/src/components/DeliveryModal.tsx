import { useState } from 'react';
import { ethers } from 'ethers';
import { ArrowRight, Check, ExternalLink, Loader2, ShieldCheck, X } from 'lucide-react';
import { BOT_CHAIN, getBrowserSigner, switchToBotChain, type OnChainAgreement } from '@/lib/web3';

interface DeliveryModalProps {
  agreement: OnChainAgreement;
  onClose: () => void;
  onSuccess: () => void;
  userAddress?: string;
}

export function DeliveryModal({ agreement, onClose, onSuccess, userAddress }: DeliveryModalProps) {
  const [evidenceInput, setEvidenceInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionDone, setActionDone] = useState<string | null>(null);
  const [txHash, setTxHash] = useState('');

  const isBuyer = userAddress && agreement.buyer.toLowerCase() === userAddress.toLowerCase();
  const isProvider = userAddress && agreement.provider.toLowerCase() === userAddress.toLowerCase();

  const handleAction = async (action: 'deliver' | 'release' | 'finalize' | 'refund') => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      const { signer, chainId } = await getBrowserSigner();
      if (chainId !== BOT_CHAIN.chainId) {
        await switchToBotChain();
      }

      const contract = new ethers.Contract(BOT_CHAIN.contractAddress, BOT_CHAIN.abi, signer);
      let tx: ethers.ContractTransactionResponse;

      if (action === 'deliver') {
        let hash = evidenceInput.trim();
        if (!hash.startsWith('0x') || hash.length !== 66) {
          // If plain text provided, hash it to bytes32
          hash = ethers.keccak256(ethers.toUtf8Bytes(hash || 'delivery-evidence-payload'));
        }
        tx = await contract.submitDelivery(agreement.id, hash);
      } else if (action === 'release') {
        tx = await contract.releasePayment(agreement.id);
      } else if (action === 'finalize') {
        tx = await contract.finalizeAfterReview(agreement.id);
      } else {
        tx = await contract.refundUndelivered(agreement.id);
      }

      setTxHash(tx.hash);
      await tx.wait();
      setActionDone(action);
      onSuccess();
    } catch (err: any) {
      console.error(`Action ${action} failed:`, err);
      const msg = err.reason || err.shortMessage || err.message || 'Transaction failed.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <div className="modal" role="dialog" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">AGREEMENT #{agreement.id}</span>
            <h2>Lifecycle Action</h2>
          </div>
          <button className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        {actionDone ? (
          <div className="success-state">
            <div className="success-icon">
              <Check size={22} />
            </div>
            <h3>Transaction Confirmed</h3>
            <p>The on-chain state of Agreement #{agreement.id} has updated successfully on BOT Chain Mainnet.</p>
            {txHash && (
              <a
                href={`${BOT_CHAIN.blockExplorer}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
                style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                View on Botscan <ExternalLink size={14} />
              </a>
            )}
            <div style={{ marginTop: 24 }}>
              <button className="button button-light" onClick={onClose} type="button">
                Done
              </button>
            </div>
          </div>
        ) : (
          <div style={{ paddingTop: 20 }}>
            <div className="review-list">
              <div>
                <span>Status</span>
                <strong>{agreement.statusLabel}</strong>
              </div>
              <div>
                <span>Amount</span>
                <strong>{agreement.amount} BOT</strong>
              </div>
              <div>
                <span>Buyer</span>
                <strong style={{ fontSize: 11, wordBreak: 'break-all' }}>{agreement.buyer}</strong>
              </div>
              <div>
                <span>Provider</span>
                <strong style={{ fontSize: 11, wordBreak: 'break-all' }}>{agreement.provider}</strong>
              </div>
              {agreement.deliveryEvidenceHash && agreement.deliveryEvidenceHash !== ethers.ZeroHash && (
                <div>
                  <span>Evidence Hash</span>
                  <strong style={{ fontSize: 10, wordBreak: 'break-all' }}>{agreement.deliveryEvidenceHash}</strong>
                </div>
              )}
            </div>

            {errorMsg && <p className="form-error" style={{ marginTop: 16 }}>{errorMsg}</p>}

            {/* Action buttons depending on state */}
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {agreement.status === 1 && (
                <>
                  <label style={{ fontSize: 11, color: '#777', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                    Delivery Evidence Payload or Hash
                    <input
                      style={{
                        width: '100%',
                        marginTop: 6,
                        padding: 10,
                        border: '1px solid rgba(0,0,0,0.15)',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      value={evidenceInput}
                      onChange={(e) => setEvidenceInput(e.target.value)}
                      placeholder="e.g. 0x... or result payload"
                    />
                  </label>
                  <button
                    className="button button-light"
                    disabled={submitting}
                    onClick={() => handleAction('deliver')}
                    type="button"
                  >
                    {submitting ? <Loader2 size={15} className="animate-spin" /> : 'Submit Service Delivery'}
                  </button>
                  <button
                    className="button button-quiet"
                    disabled={submitting}
                    onClick={() => handleAction('refund')}
                    type="button"
                    style={{ color: '#a63d36' }}
                  >
                    Claim Refund (if past service deadline)
                  </button>
                </>
              )}

              {agreement.status === 2 && (
                <>
                  <button
                    className="button button-light"
                    disabled={submitting}
                    onClick={() => handleAction('release')}
                    type="button"
                  >
                    {submitting ? <Loader2 size={15} className="animate-spin" /> : 'Release Payment to Provider'}
                  </button>
                  <button
                    className="button button-outline"
                    disabled={submitting}
                    onClick={() => handleAction('finalize')}
                    type="button"
                    style={{ color: '#111', borderColor: 'rgba(0,0,0,0.2)' }}
                  >
                    Finalize Settlement (if review window expired)
                  </button>
                </>
              )}

              {(agreement.status === 3 || agreement.status === 4) && (
                <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>
                  <ShieldCheck size={32} style={{ margin: '0 auto 8px', color: '#111' }} />
                  <p>This agreement has reached its irreversible terminal state.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
