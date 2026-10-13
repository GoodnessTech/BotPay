import { Check, ChevronRight, CircleAlert, LockKeyhole, RotateCcw, Send, ShieldCheck, Sparkles } from 'lucide-react';
import type { StageStatus } from '@/types';

type FlowPreviewProps = {
  activeStage: number;
  onNext: () => void;
  onReset: () => void;
};

const stages = [
  { label: 'Request', description: 'Agent A requests a service.', icon: Send, accent: 'mint' },
  { label: 'Quote', description: 'Agent B proposes terms.', icon: Sparkles, accent: 'blue' },
  { label: 'Escrow', description: 'Payment is authorized and locked.', icon: LockKeyhole, accent: 'lavender' },
  { label: 'Delivery', description: 'The service result is submitted.', icon: Send, accent: 'yellow' },
  { label: 'Verify', description: 'Conditions check the delivery.', icon: ShieldCheck, accent: 'mint' },
  { label: 'Settle', description: 'Funds release by agreement.', icon: Check, accent: 'blue' },
];

function getStatus(index: number, activeStage: number): StageStatus {
  if (index < activeStage) return 'complete';
  if (index === activeStage) return 'active';
  return 'waiting';
}

export function FlowPreview({ activeStage, onNext, onReset }: FlowPreviewProps) {
  const finished = activeStage === stages.length;

  return (
    <section className="section flow-section" id="flow">
      <div className="section-heading flow-heading">
        <p className="eyebrow">02 / THE LIFECYCLE</p>
        <h2>A service request becomes a settled payment.</h2>
        <p className="section-copy">A clear path from intent to verified delivery, designed for software that acts on its own.</p>
      </div>

      <div className="flow-card">
        <div className="flow-card-top">
          <div>
            <span className="preview-label">Illustrative preview — not an on-chain transaction</span>
            <h3>API data retrieval</h3>
          </div>
          <span className="status-chip"><span className="status-dot" /> Awaiting authorization</span>
        </div>
        <div className="preview-meta">
          <div><span>Buyer</span><strong>Agent Atlas</strong></div>
          <div><span>Provider</span><strong>Agent Nova</strong></div>
          <div><span>Quote</span><strong>0.002 BOT</strong></div>
        </div>

        <div className="stage-grid">
          {stages.map((stage, index) => {
            const status = getStatus(index, activeStage);
            const Icon = stage.icon;
            return (
              <div className={`stage stage-${status}`} key={stage.label}>
                <div className={`stage-icon accent-${stage.accent}`}>
                  {status === 'complete' ? <Check size={17} strokeWidth={2.5} /> : <Icon size={17} />}
                </div>
                <div className="stage-index">0{index + 1}</div>
                <h4>{stage.label}</h4>
                <p>{stage.description}</p>
                <span className="stage-state">{status === 'active' ? 'In progress' : status === 'complete' ? 'Completed' : 'Waiting'}</span>
              </div>
            );
          })}
        </div>

        <div className="flow-controls">
          <div className="progress-track"><span style={{ width: `${(activeStage / stages.length) * 100}%` }} /></div>
          <div className="flow-actions">
            <span>{finished ? 'Lifecycle preview complete' : `Stage ${activeStage + 1} of ${stages.length}`}</span>
            <div>
              <button className="button button-quiet" onClick={onReset} type="button"><RotateCcw size={15} /> Reset</button>
              <button className="button button-light" disabled={finished} onClick={onNext} type="button">{finished ? 'Completed' : 'Next stage'} {!finished && <ChevronRight size={16} />}</button>
            </div>
          </div>
        </div>
        {finished && <p className="flow-note"><CircleAlert size={15} /> This is a visual preview only. No wallet authorization or funds movement has occurred.</p>}
      </div>
    </section>
  );
}
