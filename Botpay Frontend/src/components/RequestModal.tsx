import { ArrowLeft, ArrowRight, Check, ExternalLink, Loader2, Network, ShieldCheck, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ethers } from 'ethers';
import { BOT_CHAIN, getBrowserSigner, switchToBotChain } from '@/lib/web3';
import type { ServiceCategory } from '@/types';

type RequestModalProps = {
  onClose: () => void;
  onSaved: () => void;
  connectedAccount?: string;
};

interface RequestForm {
  providerAddress: string;
  serviceCategory: ServiceCategory;
  serviceDescription: string;
  amount: string;
  deadlineMinutes: string;
  reviewHours: string;
  verificationRequirements: string;
}

const initialForm: RequestForm = {
  providerAddress: '',
  serviceCategory: 'API',
  serviceDescription: '',
  amount: '0.01',
  deadlineMinutes: '60',
  reviewHours: '2',
  verificationRequirements: 'Payload matches schema and delivery evidence hash is submitted on-chain.',
};

export function RequestModal({ onClose, onSaved, connectedAccount }: RequestModalProps) {
  const [form, setForm] = useState<RequestForm>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof RequestForm, string>>>({});
  const [review, setReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState('');

  const update = (key: keyof RequestForm, value: string) => setForm((c) => ({ ...c, [key]: value }));

  const handleReview = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Partial<Record<keyof RequestForm, string>> = {};

    if (!form.providerAddress.trim()) {
      nextErrors.providerAddress = 'Provide a valid provider address.';
    } else if (!ethers.isAddress(form.providerAddress.trim())) {
      nextErrors.providerAddress = 'Must be a valid 0x EVM address.';
    }

    if (!form.serviceDescription.trim()) {
      nextErrors.serviceDescription = 'Describe the service requirement.';
    }

    if (!form.amount || Number(form.amount) <= 0) {
      nextErrors.amount = 'Amount must be greater than zero.';
    }

    const mins = Number(form.deadlineMinutes);
    if (!mins || mins <= 0) {
      nextErrors.deadlineMinutes = 'Deadline must be at least 1 minute in the future.';
    }

    const rHours = Number(form.reviewHours);
    if (!rHours || rHours <= 0 || rHours > 720) {
      nextErrors.reviewHours = 'Review window must be between 1 and 720 hours.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setReview(true);
    }
  };

  const handleCreateAndFund = async () => {
    setSubmitting(true);
    setSubmitError('');

    try {
      const { signer, address, chainId } = await getBrowserSigner();

      if (chainId !== BOT_CHAIN.chainId) {
        await switchToBotChain();
      }

      if (form.providerAddress.trim().toLowerCase() === address.toLowerCase()) {
        throw new Error('Self-payment is prohibited. Provider must be different from buyer.');
      }

      const contract = new ethers.Contract(BOT_CHAIN.contractAddress, BOT_CHAIN.abi, signer);
      const deadlineUnix = Math.floor(Date.now() / 1000) + Math.floor(Number(form.deadlineMinutes) * 60);
      const reviewDurationSec = Math.floor(Number(form.reviewHours) * 3600);
      const valueWei = ethers.parseEther(form.amount);

      const tx = await contract.createAndFund(
        form.providerAddress.trim(),
        deadlineUnix,
        reviewDurationSec,
        { value: valueWei }
      );

      setTxHash(tx.hash);
      const receipt = await tx.wait();

      let agreementId = 0;
      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === 'AgreementCreated') {
            agreementId = Number(parsed.args[0]);
            break;
          }
        } catch {
          // ignore
        }
      }

      setCreatedId(agreementId);
      onSaved();
    } catch (err: any) {
      console.error('Error executing createAndFund:', err);
      const msg = err.reason || err.shortMessage || err.message || 'Transaction failed or was rejected.';
      setSubmitError(msg);
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
      <div aria-labelledby="request-title" aria-modal="true" className="modal" role="dialog">
        <div className="modal-header">
          <div>
            <span className="eyebrow">BOT CHAIN ESCROW PROTOCOL</span>
            <h2 id="request-title">Create On-Chain Agreement</h2>
          </div>
          <button aria-label="Close form" className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>

        {createdId !== null ? (
          <div className="success-state">
            <div className="success-icon">
              <Check size={22} />
            </div>
            <h3>Agreement #{createdId} Created & Funded</h3>
            <p>
              Your escrow agreement has been broadcast and verified on BOT Chain Mainnet. Native BOT is locked until service delivery is verified.
            </p>
            {txHash && (
              <div style={{ marginTop: 12, marginBottom: 20 }}>
                <a
                  href={`${BOT_CHAIN.blockExplorer}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  View on Botscan <ExternalLink size={14} />
                </a>
              </div>
            )}
            <button className="button button-light" onClick={onClose} type="button">
              Done
            </button>
          </div>
        ) : review ? (
          <div className="review-state">
            <div className="review-banner" style={{ background: '#d7f5d0', color: '#111' }}>
              <span>Target Network</span>
              <strong>BOT Chain Mainnet (Chain ID 677)</strong>
            </div>
            <div className="review-list">
              <div>
                <span>Provider (Beneficiary)</span>
                <strong style={{ wordBreak: 'break-all' }}>{form.providerAddress}</strong>
              </div>
              <div>
                <span>Locked Amount</span>
                <strong>{form.amount} BOT</strong>
              </div>
              <div>
                <span>Service Category</span>
                <strong>{form.serviceCategory}</strong>
              </div>
              <div>
                <span>Service Deadline</span>
                <strong>+{form.deadlineMinutes} mins from funding</strong>
              </div>
              <div>
                <span>Review Window</span>
                <strong>{form.reviewHours} hours after delivery</strong>
              </div>
              <div>
                <span>Escrow Contract</span>
                <strong style={{ fontSize: 11, wordBreak: 'break-all' }}>{BOT_CHAIN.contractAddress}</strong>
              </div>
            </div>

            <p className="review-warning">
              Funding requires a single native BOT transaction. Funds remain protected in the non-upgradeable BotPayEscrow contract.
            </p>

            {submitError && <p className="form-error">{submitError}</p>}

            <div className="modal-actions">
              <button className="button button-quiet" onClick={() => setReview(false)} type="button" disabled={submitting}>
                <ArrowLeft size={15} /> Edit details
              </button>
              <button
                className="button button-light"
                disabled={submitting}
                onClick={handleCreateAndFund}
                type="button"
              >
                {submitting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Confirming on-chain…
                  </>
                ) : (
                  <>Fund Escrow ({form.amount} BOT) <ArrowRight size={15} /></>
                )}
              </button>
            </div>
          </div>
        ) : (
          <form className="request-form" onSubmit={handleReview}>
            <div className="form-intro">
              <p>Lock native BOT into decentralized escrow for autonomous service execution.</p>
              <span>STEP 01 / SPECIFICATION</span>
            </div>
            <div className="form-grid">
              <label className="form-wide">
                Provider Address (0x…) *
                <input
                  value={form.providerAddress}
                  onChange={(e) => update('providerAddress', e.target.value)}
                  placeholder="0x34a19B30d9edD62424802d323E81c25599A9f02e"
                />
                {errors.providerAddress && <small>{errors.providerAddress}</small>}
              </label>

              <label>
                Service Category
                <select
                  value={form.serviceCategory}
                  onChange={(e) => update('serviceCategory', e.target.value as ServiceCategory)}
                >
                  <option value="API">API Access</option>
                  <option value="Compute">Compute Workload</option>
                  <option value="Data">Data Feed</option>
                </select>
              </label>

              <label>
                Payment Amount (BOT) *
                <input
                  inputMode="decimal"
                  min="0.000001"
                  step="0.000001"
                  type="number"
                  value={form.amount}
                  onChange={(e) => update('amount', e.target.value)}
                  placeholder="0.01"
                />
                {errors.amount && <small>{errors.amount}</small>}
              </label>

              <label>
                Service Deadline (Minutes) *
                <input
                  type="number"
                  min="1"
                  value={form.deadlineMinutes}
                  onChange={(e) => update('deadlineMinutes', e.target.value)}
                  placeholder="60"
                />
                {errors.deadlineMinutes && <small>{errors.deadlineMinutes}</small>}
              </label>

              <label>
                Review Window (Hours) *
                <input
                  type="number"
                  min="1"
                  max="720"
                  value={form.reviewHours}
                  onChange={(e) => update('reviewHours', e.target.value)}
                  placeholder="2"
                />
                {errors.reviewHours && <small>{errors.reviewHours}</small>}
              </label>

              <label className="form-wide">
                Service Description *
                <textarea
                  value={form.serviceDescription}
                  onChange={(e) => update('serviceDescription', e.target.value)}
                  placeholder="Structured API query or compute workload description…"
                  rows={2}
                />
                {errors.serviceDescription && <small>{errors.serviceDescription}</small>}
              </label>

              <label className="form-wide">
                Verification Requirements
                <textarea
                  value={form.verificationRequirements}
                  onChange={(e) => update('verificationRequirements', e.target.value)}
                  rows={2}
                />
              </label>
            </div>

            <div className="modal-actions">
              <span className="form-footnote">Network: BOT Chain (ID 677)</span>
              <button className="button button-light" type="submit">
                Review and Fund <ArrowRight size={15} />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
