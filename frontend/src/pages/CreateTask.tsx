import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WalletState } from '../blockchain/wallet';
import { createTask } from '../blockchain/contract';
import { MST_EXPLORER_URL } from '../blockchain/config';
import type { TxStep } from '../types/task';
import { TX_STEP_LABELS } from '../types/task';
import TransactionLink from '../components/TransactionLink';

interface CreateTaskProps {
  wallet: WalletState;
  onWalletError: (msg: string) => void;
}

interface FormData {
  taskId: string;
  packageId: string;
  source: string;
  destination: string;
  reward: string;
}

interface FormErrors {
  taskId?: string;
  packageId?: string;
  source?: string;
  destination?: string;
  reward?: string;
}

function validateForm(data: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!data.taskId.trim()) errors.taskId = 'Task ID is required.';
  else if (!/^[A-Za-z0-9_-]+$/.test(data.taskId.trim()))
    errors.taskId = 'Task ID can only contain letters, numbers, dashes, underscores.';
  if (!data.packageId.trim()) errors.packageId = 'Package ID is required.';
  if (!data.source.trim()) errors.source = 'Source location is required.';
  if (!data.destination.trim()) errors.destination = 'Destination is required.';
  const r = parseFloat(data.reward);
  if (!data.reward || isNaN(r) || r <= 0) errors.reward = 'Reward must be a positive number.';
  return errors;
}

export default function CreateTask({ wallet, onWalletError }: CreateTaskProps) {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormData>({
    taskId: '',
    packageId: '',
    source: '',
    destination: '',
    reward: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [txStep, setTxStep] = useState<TxStep>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxError(null);
    setTxHash(null);

    if (!wallet.isConnected) {
      onWalletError('Please connect your BridgeKey wallet before creating a task.');
      return;
    }

    if (!wallet.isCorrectNetwork) {
      onWalletError('Please switch your wallet to MST Testnet (Chain ID 91562037).');
      return;
    }

    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setTxStep('preparing');
      await new Promise((r) => setTimeout(r, 300)); // brief pause for UX

      setTxStep('awaiting-approval');
      const tx = await createTask(
        form.taskId.trim(),
        form.reward,
        form.packageId.trim(),
        form.source.trim(),
        form.destination.trim()
      );

      setTxStep('submitted');
      setTxHash(tx.hash);

      setTxStep('confirming');
      await tx.wait(1);

      setTxStep('confirmed');
    } catch (err: unknown) {
      setTxStep('failed');
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes('user rejected') || msg.includes('ACTION_REJECTED')) {
        setTxError('Transaction was rejected in the wallet.');
      } else if (msg.includes('insufficient funds')) {
        setTxError('Insufficient MST Testnet balance to pay for gas.');
      } else if (msg.includes('Task ID already exists')) {
        setTxError(
          `Task ID "${form.taskId}" already exists on-chain. Please use a different ID.`
        );
      } else {
        setTxError(msg.slice(0, 200));
      }
    }
  };

  const isSubmitting = ['preparing', 'awaiting-approval', 'submitted', 'confirming'].includes(txStep);
  const isConfirmed = txStep === 'confirmed';

  return (
    <div className="main-content">
      <div className="page-container">
        <div className="page-hero">
          <h1 className="page-hero__title">Create Task</h1>
          <p className="page-hero__subtitle">
            Register a new physical delivery task on the MST Blockchain
          </p>
        </div>

        <div className="create-task-page">
          {/* Wallet warning */}
          {!wallet.isConnected && (
            <div className="alert alert--warning mb-24">
              <span>🔑</span>
              <div>
                <strong>Wallet not connected.</strong> Connect your BridgeKey wallet using the
                button in the top-right corner to submit this transaction.
              </div>
            </div>
          )}

          {!wallet.isCorrectNetwork && wallet.isConnected && (
            <div className="alert alert--warning mb-24">
              <span>⚠️</span>
              <span>Please switch your wallet to MST Testnet (Chain ID 91562037).</span>
            </div>
          )}

          <div className="card">
            {/* TX Progress */}
            {txStep !== 'idle' && (
              <div
                className={`tx-progress ${txStep === 'confirmed' ? 'tx-progress--success' : ''} ${txStep === 'failed' ? 'tx-progress--failed' : ''}`}
              >
                {isSubmitting && <div className="spinner spinner--sm" />}
                {txStep === 'confirmed' && <span>✅</span>}
                {txStep === 'failed' && <span>❌</span>}
                <span>{TX_STEP_LABELS[txStep]}</span>
              </div>
            )}

            {/* TX Hash */}
            {txHash && (
              <div className="mb-16">
                <div className="detail-field__label mb-8">Transaction Hash</div>
                <TransactionLink hash={txHash} />
                {isConfirmed && (
                  <a
                    href={`${MST_EXPLORER_URL}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--outline btn--sm"
                    style={{ marginTop: '10px', display: 'inline-flex' }}
                  >
                    View on MSTScan ↗
                  </a>
                )}
              </div>
            )}

            {/* TX Error */}
            {txError && (
              <div className="alert alert--error mb-16">
                <span>⚠️</span>
                <span>{txError}</span>
              </div>
            )}

            {/* Confirmed actions */}
            {isConfirmed && (
              <div className="flex gap-8 mb-16">
                <button
                  className="btn btn--primary btn--sm"
                  onClick={() => navigate(`/task/${form.taskId.trim()}`)}
                >
                  View Task →
                </button>
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={() => {
                    setForm({ taskId: '', packageId: '', source: '', destination: '', reward: '' });
                    setTxStep('idle');
                    setTxHash(null);
                    setTxError(null);
                  }}
                >
                  Create Another
                </button>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate data-testid="create-task-form">
              <div className="form-group">
                <label className="form-label" htmlFor="taskId">
                  Task ID <span>*</span>
                </label>
                <input
                  id="taskId"
                  name="taskId"
                  className="form-input"
                  type="text"
                  placeholder="e.g. T002"
                  value={form.taskId}
                  onChange={handleChange}
                  disabled={isSubmitting || isConfirmed}
                />
                {errors.taskId && <span className="form-error">{errors.taskId}</span>}
                <span className="form-hint">Must be unique on-chain. Cannot be changed after creation.</span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="packageId">
                  Package ID <span>*</span>
                </label>
                <input
                  id="packageId"
                  name="packageId"
                  className="form-input"
                  type="text"
                  placeholder="e.g. P02"
                  value={form.packageId}
                  onChange={handleChange}
                  disabled={isSubmitting || isConfirmed}
                />
                {errors.packageId && <span className="form-error">{errors.packageId}</span>}
                <span className="form-hint">RFID tag or package identifier.</span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="source">
                  Source (Pickup Location) <span>*</span>
                </label>
                <input
                  id="source"
                  name="source"
                  className="form-input"
                  type="text"
                  placeholder="e.g. Zone A"
                  value={form.source}
                  onChange={handleChange}
                  disabled={isSubmitting || isConfirmed}
                />
                {errors.source && <span className="form-error">{errors.source}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="destination">
                  Destination (Delivery Location) <span>*</span>
                </label>
                <input
                  id="destination"
                  name="destination"
                  className="form-input"
                  type="text"
                  placeholder="e.g. Zone B"
                  value={form.destination}
                  onChange={handleChange}
                  disabled={isSubmitting || isConfirmed}
                />
                {errors.destination && <span className="form-error">{errors.destination}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reward">
                  Reward (MSTC) <span>*</span>
                </label>
                <input
                  id="reward"
                  name="reward"
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder="e.g. 100"
                  value={form.reward}
                  onChange={handleChange}
                  disabled={isSubmitting || isConfirmed}
                />
                {errors.reward && <span className="form-error">{errors.reward}</span>}
                <span className="form-hint">
                  Amount in MSTC the robot receives upon verified completion. Stored in smart contract
                  escrow.
                </span>
              </div>

              <div className="alert alert--info mb-24">
                <span>ℹ️</span>
                <span>
                  This will submit a real transaction to the ProofToPay contract on MST Testnet.
                  You will be asked to approve it in your BridgeKey wallet. Gas fees apply.
                </span>
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--full btn--lg"
                disabled={isSubmitting || isConfirmed || !wallet.isConnected}
                data-testid="submit-create-task"
              >
                {isSubmitting ? (
                  <>
                    <div className="spinner spinner--sm spinner--white" />
                    {TX_STEP_LABELS[txStep]}
                  </>
                ) : (
                  '⚡ Create Task on MST Testnet'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
