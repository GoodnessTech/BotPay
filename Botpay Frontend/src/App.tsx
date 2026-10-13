import { ArrowDownRight, ArrowUpRight, Circle, ExternalLink, Menu, MoveUpRight, Network, Plus, ShieldCheck, Sparkles, Wallet, X, RefreshCw } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { FlowPreview } from '@/components/FlowPreview';
import { RequestModal } from '@/components/RequestModal';
import { DeliveryModal } from '@/components/DeliveryModal';
import {
  BOT_CHAIN,
  getBrowserSigner,
  switchToBotChain,
  fetchLiveAgreementCount,
  fetchAllAgreements,
  getWalletBalance,
  type OnChainAgreement,
} from '@/lib/web3';

const useCases = [
  { label: 'API ACCESS', title: 'Pay for answers, not interfaces.', copy: 'Agents request structured responses and settle when the agreed payload arrives.', accent: 'mint', visual: <><span className="api-line line-one" /><span className="api-line line-two" /><span className="api-cursor">▍</span></> },
  { label: 'COMPUTE', title: 'Workloads with a clear finish line.', copy: 'Reserve compute, attach conditions, and release the quote after the job is verified.', accent: 'blue', visual: <><span className="compute-block block-one" /><span className="compute-block block-two" /><span className="compute-block block-three" /></> },
  { label: 'DATA ACCESS', title: 'Evidence travels with the value.', copy: 'Purchase authorized datasets with delivery references and explicit verification rules.', accent: 'lavender', visual: <><span className="data-ring" /><span className="data-ring ring-two" /><span className="data-dot" /></> },
];

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAgreement, setSelectedAgreement] = useState<OnChainAgreement | null>(null);
  const [activeStage, setActiveStage] = useState(0);

  // Live Blockchain State
  const [walletConnected, setWalletConnected] = useState(false);
  const [connectedAddress, setConnectedAddress] = useState<string>('');
  const [walletBalance, setWalletBalance] = useState<string>('0.0');
  const [currentChainId, setCurrentChainId] = useState<number | null>(null);
  const [agreementCount, setAgreementCount] = useState<number>(0);
  const [agreements, setAgreements] = useState<OnChainAgreement[]>([]);
  const [loadingState, setLoadingState] = useState(false);

  const isCorrectNetwork = currentChainId === BOT_CHAIN.chainId;

  const loadBlockchainData = useCallback(async () => {
    setLoadingState(true);
    try {
      const count = await fetchLiveAgreementCount();
      setAgreementCount(count);
      const items = await fetchAllAgreements();
      setAgreements(items);

      if (connectedAddress) {
        const bal = await getWalletBalance(connectedAddress);
        setWalletBalance(bal);
      }
    } catch (err) {
      console.warn('Error reading on-chain data:', err);
    } finally {
      setLoadingState(false);
    }
  }, [connectedAddress]);

  useEffect(() => {
    loadBlockchainData();
  }, [loadBlockchainData]);

  // Handle wallet connection
  const handleConnectWallet = async () => {
    try {
      const { address, chainId } = await getBrowserSigner();
      setConnectedAddress(address);
      setCurrentChainId(chainId);
      setWalletConnected(true);

      if (chainId !== BOT_CHAIN.chainId) {
        await switchToBotChain();
        const updated = await getBrowserSigner();
        setCurrentChainId(updated.chainId);
      }

      const bal = await getWalletBalance(address);
      setWalletBalance(bal);
    } catch (err: any) {
      console.error('Wallet connection failed:', err);
      alert(err.message || 'Failed to connect wallet.');
    }
  };

  const handleDisconnectWallet = () => {
    setWalletConnected(false);
    setConnectedAddress('');
    setWalletBalance('0.0');
  };

  // Listen to provider events if window.ethereum exists
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const eth = (window as any).ethereum;
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          setConnectedAddress(accounts[0]);
          setWalletConnected(true);
          getWalletBalance(accounts[0]).then(setWalletBalance);
        } else {
          handleDisconnectWallet();
        }
      };

      const handleChainChanged = (hexChainId: string) => {
        const chainId = parseInt(hexChainId, 16);
        setCurrentChainId(chainId);
      };

      eth.on('accountsChanged', handleAccountsChanged);
      eth.on('chainChanged', handleChainChanged);

      return () => {
        eth.removeListener('accountsChanged', handleAccountsChanged);
        eth.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatAddr = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  };

  return (
    <main className="site-shell">
      <nav className="topbar">
        <button className="wordmark" onClick={() => scrollTo('top')} type="button">
          <span className="wordmark-mark">
            <ArrowUpRight size={12} />
          </span>
          BotPay
        </button>
        <div className={`nav-links ${menuOpen ? 'is-open' : ''}`}>
          <button onClick={() => scrollTo('flow')} type="button">How it works</button>
          <button onClick={() => scrollTo('use-cases')} type="button">Use cases</button>
          <button onClick={() => scrollTo('activity')} type="button">Activity</button>
          <button onClick={() => scrollTo('trust')} type="button">Contract & Trust</button>
          {walletConnected ? (
            <button
              className="nav-wallet"
              onClick={handleDisconnectWallet}
              title={`Connected: ${connectedAddress}\nBalance: ${walletBalance} BOT`}
              type="button"
            >
              <Wallet size={15} /> {formatAddr(connectedAddress)} · {parseFloat(walletBalance).toFixed(3)} BOT
            </button>
          ) : (
            <button className="nav-wallet" onClick={handleConnectWallet} type="button">
              <Wallet size={15} /> Connect wallet
            </button>
          )}
        </div>
        <button
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
          className="menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          {menuOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
      </nav>

      <section className="hero" id="top">
        <div className="hero-kicker">
          <span className="live-dot" /> Autonomous payments infrastructure <span className="kicker-line" />
        </div>
        <div className="hero-copy">
          <h1>
            Agents pay.<br />
            <span className="hero-highlight">Services</span> execute<span className="hero-period">.</span>
          </h1>
          <p>Machine-to-machine native payments on BOT Chain Mainnet. Quote, escrow, verify, and settle without a human checkout.</p>
        </div>
        <span className="float-label label-api">API payments <ArrowUpRight size={13} /></span>
        <span className="float-label label-agent">Agent-to-agent <Circle size={7} fill="currentColor" /></span>
        <span className="float-label label-escrow">Conditional escrow <ShieldCheck size={13} /></span>
        <span className="float-label label-settle">Automated settlement <ArrowDownRight size={13} /></span>
        <div className="hero-actions">
          <button className="button button-light" onClick={() => scrollTo('flow')} type="button">
            Explore the protocol <ArrowDownRight size={16} />
          </button>
          <button className="button button-outline" onClick={() => setModalOpen(true)} type="button">
            Create payment request
          </button>
        </div>
        <div className="hero-metrics">
          <div>
            <span>Payment lifecycle</span>
            <strong>6 stages</strong>
          </div>
          <div>
            <span>Escrow Type</span>
            <strong>Native BOT Escrow</strong>
          </div>
          <div>
            <span>Network</span>
            <strong>
              BOT Chain Mainnet <i style={{ color: '#d7f5d0', fontStyle: 'normal' }}>● Live (Chain ID 677)</i>
            </strong>
          </div>
        </div>
      </section>

      <FlowPreview
        activeStage={activeStage}
        onNext={() => setActiveStage((stage) => Math.min(stage + 1, 6))}
        onReset={() => setActiveStage(0)}
      />

      <section className="section use-cases" id="use-cases">
        <div className="section-heading">
          <p className="eyebrow">03 / DESIGNED FOR SERVICES</p>
          <h2>Three ways autonomous work gets done.</h2>
        </div>
        <div className="use-case-grid">
          {useCases.map((item) => (
            <article className={`use-case-card accent-card-${item.accent}`} key={item.label}>
              <div className="use-case-visual">{item.visual}</div>
              <span className="eyebrow">{item.label}</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
              <button className="text-link" onClick={() => setModalOpen(true)} type="button">
                Start a request <MoveUpRight size={14} />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="section dashboard" id="activity">
        <div className="section-heading dashboard-heading">
          <div>
            <p className="eyebrow">04 / OPERATIONAL VIEW</p>
            <h2>One surface for every agreement.</h2>
          </div>
          <button className="button button-light" onClick={() => setModalOpen(true)} type="button">
            <Plus size={16} /> Create payment request
          </button>
        </div>
        <div className="dashboard-grid">
          <div className="status-panel">
            <div className="panel-heading">
              <span>Network status</span>
              <Network size={17} />
            </div>
            <div className="network-state">
              <span className="network-icon">
                <Network size={19} />
              </span>
              <div>
                <strong>BOT Chain Mainnet</strong>
                <p>Chain ID 677 · RPC Live</p>
              </div>
              <span className="status-pill" style={{ color: '#d7f5d0', borderColor: 'rgba(215,245,208,.4)' }}>
                Online
              </span>
            </div>

            <div style={{ marginTop: 20, fontSize: 11, color: '#888', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div>
                <span style={{ textTransform: 'uppercase', fontSize: 9, color: '#666' }}>Contract Address:</span>
                <p style={{ fontFamily: 'monospace', color: '#fff', wordBreak: 'break-all', marginTop: 2 }}>
                  <a
                    href={`${BOT_CHAIN.blockExplorer}/address/${BOT_CHAIN.contractAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#d7f5d0', textDecoration: 'none' }}
                  >
                    {BOT_CHAIN.contractAddress}
                  </a>
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span>Total On-Chain Agreements:</span>
                <strong style={{ color: '#fff' }}>{agreementCount}</strong>
              </div>
            </div>

            <div className="panel-divider" />
            <div className="empty-mini">
              <Wallet size={17} />
              <span>
                {walletConnected
                  ? `Connected: ${formatAddr(connectedAddress)} (${parseFloat(walletBalance).toFixed(4)} BOT)`
                  : 'Connect a wallet to trigger delivery or payment releases.'}
              </span>
            </div>
            {!isCorrectNetwork && walletConnected && (
              <button
                className="button button-outline"
                onClick={switchToBotChain}
                style={{ width: '100%', marginTop: 14, fontSize: 11 }}
                type="button"
              >
                Switch Wallet to BOT Chain (677)
              </button>
            )}
          </div>

          <div className="activity-panel">
            <div className="panel-heading">
              <span>Live On-Chain Agreements</span>
              <button
                onClick={loadBlockchainData}
                style={{ background: 'none', border: 0, color: '#a3a3a3', display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                title="Refresh live agreements"
                type="button"
              >
                <RefreshCw size={12} className={loadingState ? 'animate-spin' : ''} />
                <span className="muted-label">LIVE DATA</span>
              </button>
            </div>

            {agreements.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                {agreements.map((ag) => (
                  <div
                    key={ag.id}
                    className="activity-row"
                    onClick={() => setSelectedAgreement(ag)}
                    style={{ cursor: 'pointer', padding: 12, borderRadius: 8, background: '#222', marginTop: 0 }}
                  >
                    <span className={`activity-icon activity-${ag.accent}`}>
                      <ArrowUpRight size={15} />
                    </span>
                    <div>
                      <strong>Agreement #{ag.id} · {ag.amount} BOT</strong>
                      <p>
                        Buyer: {formatAddr(ag.buyer)} → Provider: {formatAddr(ag.provider)}
                      </p>
                    </div>
                    <b style={{ marginLeft: 'auto', textTransform: 'uppercase', fontSize: 10 }}>{ag.statusLabel}</b>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-orbit">
                  <Sparkles size={19} />
                </div>
                <h3>No on-chain agreements yet.</h3>
                <p>
                  Deployments are live and active on BOT Chain Mainnet. Create the first escrow payment request to populate live protocol activity.
                </p>
                <button className="text-link" onClick={() => setModalOpen(true)} type="button">
                  Create first agreement <MoveUpRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="trust-section" id="trust">
        <div className="trust-inner">
          <div className="trust-copy">
            <p className="eyebrow">05 / TRANSPARENCY BY DEFAULT</p>
            <h2>Payments should be verifiable, not merely promised.</h2>
            <p>
              On-chain settlement proves the movement of funds on BOT Chain Mainnet. BotPay enforces a non-upgradeable, owner-less escrow agreement where payments are governed entirely by autonomous state transitions and verifiable delivery hashes.
            </p>
            <a
              href={`${BOT_CHAIN.blockExplorer}/address/${BOT_CHAIN.contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              Inspect contract on Botscan <MoveUpRight size={14} />
            </a>
          </div>
          <div className="evidence-card">
            <div className="evidence-top">
              <span>Mainnet Contract Deployment</span>
              <span className="status-chip" style={{ color: '#111', background: '#d7f5d0', borderColor: 'transparent' }}>
                <span className="status-dot" style={{ background: '#111' }} /> Live on Mainnet
              </span>
            </div>
            {[
              { label: 'Contract Name', val: 'BotPayEscrow' },
              { label: 'Target Network', val: 'BOT Chain Mainnet (Chain ID 677)' },
              { label: 'Contract Address', val: formatAddr(BOT_CHAIN.contractAddress) },
              { label: 'Protocol Type', val: 'Native BOT Conditional Escrow' },
              { label: 'Settlement Model', val: 'Permissionless / M2M Finalization' },
              { label: 'Access & Control', val: 'No Admin Keys · Non-Upgradeable' },
            ].map((item, index) => (
              <div className="evidence-row" key={item.label}>
                <span>
                  <span className={`evidence-number evidence-${index > 3 ? 'mint' : index % 2 ? 'blue' : 'yellow'}`}>
                    0{index + 1}
                  </span>
                  {item.label}
                </span>
                <b>{item.val}</b>
              </div>
            ))}
            <div className="evidence-foot">
              <ExternalLink size={14} />
              <a
                href={`${BOT_CHAIN.blockExplorer}/address/${BOT_CHAIN.contractAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#777', textDecoration: 'none' }}
              >
                Official Explorer: scan.botchain.ai
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="closing-cta">
        <p className="eyebrow">A SMALL PRIMITIVE FOR A BIG SHIFT</p>
        <h2>
          Let the service<br />
          <span>settle itself.</span>
        </h2>
        <button className="button button-light" onClick={() => setModalOpen(true)} type="button">
          Create a payment request <ArrowUpRight size={16} />
        </button>
      </section>

      <footer className="footer">
        <div className="footer-brand">
          <button className="wordmark" onClick={() => scrollTo('top')} type="button">
            <span className="wordmark-mark">
              <ArrowUpRight size={12} />
            </span>
            BotPay
          </button>
          <p>
            Machine-to-machine payments,<br />
            designed for autonomous services.
          </p>
        </div>
        <div className="footer-links">
          <div>
            <span>Overview</span>
            <button onClick={() => scrollTo('flow')} type="button">How it works</button>
            <button onClick={() => scrollTo('use-cases')} type="button">Use cases</button>
            <button onClick={() => scrollTo('activity')} type="button">Activity</button>
          </div>
          <div>
            <span>Ecosystem</span>
            <a
              href="https://botchain.ai"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#a3a3a3', fontSize: 12, textDecoration: 'none' }}
            >
              Botchain
            </a>
            <a
              href="https://scan.botchain.ai"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#a3a3a3', fontSize: 12, textDecoration: 'none' }}
            >
              Botscan
            </a>
            <a
              href={`${BOT_CHAIN.blockExplorer}/address/${BOT_CHAIN.contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#a3a3a3', fontSize: 12, textDecoration: 'none' }}
            >
              Escrow Contract
            </a>
          </div>
          <div>
            <span>Network</span>
            <p style={{ margin: 0 }}>BOT Chain Mainnet</p>
            <p style={{ margin: 0, color: '#d7f5d0' }}>Chain ID: 677</p>
            <p style={{ margin: 0, fontSize: 10, fontFamily: 'monospace' }}>RPC: rpc.botchain.ai</p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 BotPay Protocol</span>
          <span>Built for autonomous agents, not checkout pages.</span>
        </div>
      </footer>

      {modalOpen && (
        <RequestModal
          connectedAccount={connectedAddress}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            loadBlockchainData();
          }}
        />
      )}

      {selectedAgreement && (
        <DeliveryModal
          agreement={selectedAgreement}
          onClose={() => setSelectedAgreement(null)}
          onSuccess={() => {
            loadBlockchainData();
          }}
          userAddress={connectedAddress}
        />
      )}
    </main>
  );
}

export default App;
