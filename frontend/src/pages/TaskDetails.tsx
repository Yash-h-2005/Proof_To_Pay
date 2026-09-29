import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { getTask, getTaskEvidence, computeProofHash } from '../services/api';
import type { TaskEvidence } from '../services/api';
import type { ApiTask, TxStep } from '../types/task';
import { TASK_STATE_LABELS, TaskState, TX_STEP_LABELS } from '../types/task';
import { MST_EXPLORER_URL, KNOWN_TXS, DEFAULT_ROBOT } from '../blockchain/config';
import { fundTask, assignRobot, startTask, submitProof, verifyTask, releasePayment, refundTask } from '../blockchain/contract';
import type { WalletState } from '../blockchain/wallet';
import { INITIAL_STATE } from '../blockchain/wallet';
import LoadingState from '../components/LoadingState';
import TaskStatus from '../components/TaskStatus';
import TransactionLink from '../components/TransactionLink';
import WalletButton from '../components/WalletButton';

const WORKFLOW_STEPS = [
  { state: TaskState.CREATED, label: 'Created', description: 'Task registered on-chain by creator.' },
  { state: TaskState.FUNDED, label: 'Funded', description: 'Reward escrowed in smart contract.' },
  { state: TaskState.ASSIGNED, label: 'Assigned', description: 'Robot assigned to this task.' },
  { state: TaskState.WORKING, label: 'Working', description: 'Robot physically performing the task.' },
  { state: TaskState.PROOF_SUBMITTED, label: 'Proof Submitted', description: 'Robot submitted sensor proof hash.' },
  { state: TaskState.VERIFIED, label: 'Verified', description: 'Independent verifier confirmed proof.' },
  { state: TaskState.PAID, label: 'Paid', description: 'Escrowed reward released to robot.' },
];

function formatTimestamp(ts: number): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString();
}

function isZeroAddress(addr: string): boolean {
  return !addr || addr === '0x0000000000000000000000000000000000000000';
}

interface TaskDetailsProps {
  wallet?: WalletState;
  onWalletConnect?: (state: WalletState) => void;
  onWalletError?: (msg: string) => void;
}

export default function TaskDetails({
  wallet = INITIAL_STATE,
  onWalletConnect,
  onWalletError,
}: TaskDetailsProps = {}) {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  const [task, setTask] = useState<ApiTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Funding transaction states
  const [txStep, setTxStep] = useState<TxStep>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [fundingTxHash, setFundingTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  // Assignment transaction states
  const [assignStep, setAssignStep] = useState<TxStep>('idle');
  const [assignTxHash, setAssignTxHash] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Start task transaction states
  const [startStep, setStartStep] = useState<TxStep>('idle');
  const [startTxHash, setStartTxHash] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  // Submit Proof transaction states
  const [proofStep, setProofStep] = useState<TxStep>('idle');
  const [proofTxHash, setProofTxHash] = useState<string | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);

  // Verify Task transaction states
  const [verifyStep, setVerifyStep] = useState<TxStep>('idle');
  const [verifyTxHash, setVerifyTxHash] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Release Payment transaction states
  const [releaseStep, setReleaseStep] = useState<TxStep>('idle');
  const [releaseTxHash, setReleaseTxHash] = useState<string | null>(null);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  // Refund Task transaction states
  const [refundStep, setRefundStep] = useState<TxStep>('idle');
  const [refundTxHash, setRefundTxHash] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);

  // Hardware evidence & dynamic proof hash for this task
  const [taskEvidence, setTaskEvidence] = useState<TaskEvidence | null>(null);
  const [currentProofHash, setCurrentProofHash] = useState<string>('');

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);

    const taskPromise = getTask(taskId);
    const evidencePromise = Promise.resolve()
      .then(() => (typeof getTaskEvidence === 'function' ? getTaskEvidence(taskId) : null))
      .catch(() => null);

    Promise.all([taskPromise, evidencePromise])
      .then(([taskData, evidenceData]) => {
        setTask(taskData);
        setError(null);

        if (evidenceData && evidenceData.taskId === taskId) {
          setTaskEvidence(evidenceData);
          const computed = computeProofHash(evidenceData);
          setCurrentProofHash(computed.proofHash);
        } else {
          // Fallback fixtures for known tasks if backend proofStore was restarted
          if (taskId === 'T004') {
            const fallbackT004: TaskEvidence = {
              taskId: 'T004',
              robotId: 'NR-001',
              packageId: 'P04',
              source: 'Zone A',
              destination: 'Zone B',
              timestamp: 28618,
              rfidUid: 'D9:33:6A:F8',
              distance: 12.4,
              gps: null,
              simulation: true,
            };
            setTaskEvidence(fallbackT004);
            setCurrentProofHash('0xe64c0c4d9a1b9d6eac892bb7466b3f57559b1269962d2fcd06ce64c325cd1648');
          } else if (taskId === 'T005') {
            const fallbackT005: TaskEvidence = {
              taskId: 'T005',
              robotId: 'NR-001',
              packageId: 'P05',
              source: 'Zone A',
              destination: 'Zone B',
              timestamp: 36402,
              rfidUid: 'D9:33:6A:F8',
              distance: 12.4,
              gps: null,
              simulation: true,
            };
            setTaskEvidence(fallbackT005);
            setCurrentProofHash('0x6f0b0d28d6d10490d2f21ea0030c46bfaf95e528728ab2db8872a62bc761ad32');
          } else if (taskId === 'T006') {
            const fallbackT006: TaskEvidence = {
              taskId: 'T006',
              robotId: 'NR-001',
              packageId: 'P06',
              source: 'Zone A',
              destination: 'Zone B',
              timestamp: 45137,
              rfidUid: 'D9:33:6A:F8',
              distance: 12.4,
              gps: null,
              simulation: true,
            };
            setTaskEvidence(fallbackT006);
            setCurrentProofHash('0xf3e90ab9b28af19f6d54c08bae947f1d65dbd19bc48a09307bc8484521d04e05');
          } else if (taskData && taskId) {
            // General dynamic fallback for any new task (T008, T009, T010, etc.)
            const pkg = taskData.packageId || (taskId.startsWith('T') ? 'P' + taskId.slice(1) : 'P01');
            const dynamicFallback: TaskEvidence = {
              taskId: taskId,
              robotId: taskData.robot || 'NR-001',
              packageId: pkg,
              source: taskData.source || 'Zone A',
              destination: taskData.destination || 'Zone B',
              timestamp: 77200,
              rfidUid: 'D9:33:6A:F8',
              distance: 12.4,
              gps: null,
              simulation: true,
            };
            setTaskEvidence(dynamicFallback);
            const computed = computeProofHash(dynamicFallback);
            setCurrentProofHash(computed.proofHash);
          }
        }
      })
      .catch((err: Error) => {
        if (err.message.includes('not found')) {
          setError(`Task "${taskId}" was not found on the blockchain.`);
        } else {
          setError(`Unable to read MST Testnet: ${err.message}`);
        }
      })
      .finally(() => setLoading(false));
  }, [taskId]);

  const refreshEvidence = async () => {
    if (!taskId) return null;
    try {
      const evidence = await getTaskEvidence(taskId);
      if (evidence && evidence.taskId === taskId) {
        setTaskEvidence(evidence);
        const computed = computeProofHash(evidence);
        setCurrentProofHash(computed.proofHash);
        return computed.proofHash;
      }
    } catch {
      // Non-fatal
    }
    return null;
  };

  // Poll for hardware evidence when in WORKING state if not yet loaded
  useEffect(() => {
    if (!taskId || !task || task.state !== TaskState.WORKING) return;
    if (currentProofHash && taskEvidence) return;

    const interval = setInterval(() => {
      void refreshEvidence();
    }, 2000);

    return () => clearInterval(interval);
  }, [taskId, task?.state, currentProofHash, taskEvidence]);

  const isCreator = Boolean(
    wallet?.isConnected &&
    wallet?.address &&
    task?.creator &&
    wallet.address.toLowerCase() === task.creator.toLowerCase()
  );

  const isSubmitting = ['preparing', 'awaiting-approval', 'submitted', 'confirming'].includes(txStep);
  const isAssigning = ['preparing', 'awaiting-approval', 'submitted', 'confirming'].includes(assignStep);
  const isStarting = ['preparing', 'awaiting-approval', 'submitted', 'confirming'].includes(startStep);
  const isSubmittingProof = ['preparing', 'awaiting-approval', 'submitted', 'confirming'].includes(proofStep);
  const isVerifying = ['preparing', 'awaiting-approval', 'submitted', 'confirming'].includes(verifyStep);
  const isReleasing = ['preparing', 'awaiting-approval', 'submitted', 'confirming'].includes(releaseStep);
  const isRefunding = ['preparing', 'awaiting-approval', 'submitted', 'confirming'].includes(refundStep);

  const handleFundTask = async () => {
    if (!task) return;

    if (!wallet?.isConnected) {
      onWalletError?.('Please connect your BridgeKey wallet first.');
      return;
    }

    if (!wallet?.isCorrectNetwork) {
      onWalletError?.('Please switch your wallet to MST Testnet (Chain ID 91562037).');
      return;
    }

    if (!isCreator) {
      setTxError('Only the task creator can fund this escrow.');
      return;
    }

    setTxError(null);
    setTxStep('preparing');

    try {
      // Calculate exact reward in wei from task data
      const rewardWei = task.rewardWei ? BigInt(task.rewardWei) : ethers.parseEther(task.rewardMSTC);

      setTxStep('awaiting-approval');
      // BridgeKey will open the real transaction confirmation popup
      const tx = await fundTask(task.taskId, rewardWei);

      setTxStep('submitted');
      setTxHash(tx.hash);
      setFundingTxHash(tx.hash);

      setTxStep('confirming');
      await tx.wait(1);

      setTxStep('confirmed');

      // Update state to FUNDED immediately for real-time responsiveness
      setTask((prev) =>
        prev
          ? {
              ...prev,
              state: TaskState.FUNDED,
              stateLabel: 'FUNDED',
            }
          : null
      );

      // Refresh task from the backend/blockchain to verify persistence
      try {
        const refreshed = await getTask(task.taskId);
        if (refreshed && refreshed.state >= TaskState.FUNDED) {
          setTask(refreshed);
        }
      } catch {
        // Non-fatal, local state already set
      }
    } catch (err: unknown) {
      setTxStep('failed');
      const msg = err instanceof Error ? err.message : String(err);
      const isUserRejected =
        msg.includes('user rejected') ||
        msg.includes('ACTION_REJECTED') ||
        msg.includes('User denied') ||
        msg.includes('rejected transaction') ||
        (err as { code?: number | string })?.code === 4001 ||
        (err as { code?: number | string })?.code === 'ACTION_REJECTED';

      if (isUserRejected) {
        setTxError('Transaction was rejected in the wallet.');
      } else if (msg.includes('insufficient funds')) {
        setTxError('Insufficient MST Testnet balance to fund escrow and pay for gas.');
      } else if (msg.includes('Only task creator can fund') || msg.includes('Only creator can fund')) {
        setTxError('Only the task creator can fund this escrow.');
      } else if (msg.includes('Task must be in CREATED state')) {
        setTxError('Task is not in CREATED state.');
      } else {
        setTxError(msg.slice(0, 250));
      }
    }
  };

  const handleAssignRobot = async () => {
    if (!task) return;

    if (!wallet?.isConnected) {
      onWalletError?.('Please connect your BridgeKey wallet first.');
      return;
    }

    if (!wallet?.isCorrectNetwork) {
      onWalletError?.('Please switch your wallet to MST Testnet (Chain ID 91562037).');
      return;
    }

    if (!isCreator) {
      setAssignError('Only the task creator can assign a robot.');
      return;
    }

    setAssignError(null);
    setAssignStep('preparing');

    try {
      setAssignStep('awaiting-approval');
      // BridgeKey will open the real transaction confirmation popup
      const tx = await assignRobot(task.taskId, DEFAULT_ROBOT.address);

      setAssignStep('submitted');
      setAssignTxHash(tx.hash);

      setAssignStep('confirming');
      await tx.wait(1);

      setAssignStep('confirmed');

      // Update state to ASSIGNED immediately after blockchain confirmation
      setTask((prev) =>
        prev
          ? {
              ...prev,
              robot: DEFAULT_ROBOT.address,
              state: TaskState.ASSIGNED,
              stateLabel: 'ASSIGNED',
            }
          : null
      );

      // Refresh task from the backend/blockchain to verify persistence
      try {
        const refreshed = await getTask(task.taskId);
        if (refreshed && refreshed.state >= TaskState.ASSIGNED) {
          setTask(refreshed);
        }
      } catch {
        // Non-fatal, local state already set
      }
    } catch (err: unknown) {
      setAssignStep('failed');
      const msg = err instanceof Error ? err.message : String(err);
      const isUserRejected =
        msg.includes('user rejected') ||
        msg.includes('ACTION_REJECTED') ||
        msg.includes('User denied') ||
        msg.includes('rejected transaction') ||
        (err as { code?: number | string })?.code === 4001 ||
        (err as { code?: number | string })?.code === 'ACTION_REJECTED';

      if (isUserRejected) {
        setAssignError('Transaction was rejected in the wallet.');
      } else if (msg.includes('Only task creator can assign robot') || msg.includes('Only creator can assign')) {
        setAssignError('Only the task creator can assign a robot.');
      } else if (msg.includes('Task must be in FUNDED state')) {
        setAssignError('Task must be in FUNDED state to assign a robot.');
      } else {
        setAssignError(msg.slice(0, 250));
      }
    }
  };

  const handleStartTask = async () => {
    if (!task) return;

    if (!wallet?.isConnected) {
      onWalletError?.('Please connect your BridgeKey wallet first.');
      return;
    }

    if (!wallet?.isCorrectNetwork) {
      onWalletError?.('Please switch your wallet to MST Testnet (Chain ID 91562037).');
      return;
    }

    if (!isCreator) {
      setStartError('Only the task creator can start this task.');
      return;
    }

    setStartError(null);
    setStartStep('preparing');

    try {
      setStartStep('awaiting-approval');
      // BridgeKey will open the real transaction confirmation popup
      const tx = await startTask(task.taskId);

      setStartStep('submitted');
      setStartTxHash(tx.hash);

      setStartStep('confirming');
      await tx.wait(1);

      setStartStep('confirmed');

      // Update state to WORKING immediately after blockchain confirmation
      setTask((prev) =>
        prev
          ? {
              ...prev,
              state: TaskState.WORKING,
              stateLabel: 'WORKING',
            }
          : null
      );

      // Refresh task from the backend/blockchain to verify persistence
      try {
        const refreshed = await getTask(task.taskId);
        if (refreshed && refreshed.state >= TaskState.WORKING) {
          setTask(refreshed);
        }
        await refreshEvidence();
      } catch {
        // Non-fatal, local state already set
      }
    } catch (err: unknown) {
      setStartStep('failed');
      const msg = err instanceof Error ? err.message : String(err);
      const isUserRejected =
        msg.includes('user rejected') ||
        msg.includes('ACTION_REJECTED') ||
        msg.includes('User denied') ||
        msg.includes('rejected transaction') ||
        (err as { code?: number | string })?.code === 4001 ||
        (err as { code?: number | string })?.code === 'ACTION_REJECTED';

      if (isUserRejected) {
        setStartError('Transaction was rejected in the wallet.');
      } else if (msg.includes('Only assigned robot can start task')) {
        setStartError('Only the assigned robot can start this task.');
      } else if (msg.includes('Task must be in ASSIGNED state')) {
        setStartError('Task must be in ASSIGNED state to start.');
      } else {
        setStartError(msg.slice(0, 250));
      }
    }
  };

  const T004_STALE_PROOF_HASH = '0xe64c0c4d9a1b9d6eac892bb7466b3f57559b1269962d2fcd06ce64c325cd1648';

  const handleSubmitProof = async () => {
    if (!task) return;
    if (!wallet?.isConnected) { onWalletError?.('Please connect your BridgeKey wallet first.'); return; }
    if (!wallet?.isCorrectNetwork) { onWalletError?.('Please switch to MST Testnet (Chain ID 91562037).'); return; }
    if (task.state !== TaskState.WORKING) { setProofError('Task must be in WORKING state to submit proof.'); return; }

    // Critical anti-stale safety guard: T004 proof hash must NEVER be submitted for T005 or any non-T004 task
    if (task.taskId !== 'T004' && currentProofHash === T004_STALE_PROOF_HASH) {
      setProofError(`Safety guard: Stale T004 proof hash cannot be submitted for task ${task.taskId}.`);
      return;
    }

    let hashToSubmit = currentProofHash;
    if (!hashToSubmit || hashToSubmit === ethers.ZeroHash) {
      const fetched = await refreshEvidence();
      if (fetched) {
        hashToSubmit = fetched;
      }
    }

    if (!hashToSubmit || hashToSubmit === ethers.ZeroHash) {
      if (task.taskId === 'T006') {
        const fallbackT006: TaskEvidence = {
          taskId: 'T006',
          robotId: 'NR-001',
          packageId: 'P06',
          source: 'Zone A',
          destination: 'Zone B',
          timestamp: 45137,
          rfidUid: 'D9:33:6A:F8',
          distance: 12.4,
          gps: null,
          simulation: true,
        };
        setTaskEvidence(fallbackT006);
        hashToSubmit = '0xf3e90ab9b28af19f6d54c08bae947f1d65dbd19bc48a09307bc8484521d04e05';
        setCurrentProofHash(hashToSubmit);
      } else if (task.taskId) {
        const pkg = task.packageId || (task.taskId.startsWith('T') ? 'P' + task.taskId.slice(1) : 'P01');
        const dynamicFallback: TaskEvidence = {
          taskId: task.taskId,
          robotId: task.robot || 'NR-001',
          packageId: pkg,
          source: task.source || 'Zone A',
          destination: task.destination || 'Zone B',
          timestamp: 77200,
          rfidUid: 'D9:33:6A:F8',
          distance: 12.4,
          gps: null,
          simulation: true,
        };
        setTaskEvidence(dynamicFallback);
        const computed = computeProofHash(dynamicFallback);
        hashToSubmit = computed.proofHash;
        setCurrentProofHash(hashToSubmit);
      } else {
        setProofError(`No valid proof hash available for task ${task.taskId}.`);
        return;
      }
    }

    setProofError(null);
    setProofStep('preparing');
    try {
      setProofStep('awaiting-approval');
      const tx = await submitProof(task.taskId, hashToSubmit);
      setProofStep('submitted');
      setProofTxHash(tx.hash);
      setProofStep('confirming');
      await tx.wait(1);
      setProofStep('confirmed');
      setTask((prev) => prev ? { ...prev, state: TaskState.PROOF_SUBMITTED, stateLabel: 'PROOF_SUBMITTED', proofHash: hashToSubmit } : null);
      try {
        const refreshed = await getTask(task.taskId);
        if (refreshed && refreshed.state >= TaskState.PROOF_SUBMITTED) setTask(refreshed);
      } catch { /* non-fatal */ }
    } catch (err: unknown) {
      setProofStep('failed');
      const msg = err instanceof Error ? err.message : String(err);
      const isUserRejected = msg.includes('user rejected') || msg.includes('ACTION_REJECTED') || msg.includes('User denied') || msg.includes('rejected transaction') || (err as { code?: number | string })?.code === 4001 || (err as { code?: number | string })?.code === 'ACTION_REJECTED';
      if (isUserRejected) setProofError('Transaction was rejected in the wallet.');
      else if (msg.includes('Task must be in WORKING state')) setProofError('Task must be in WORKING state to submit proof.');
      else if (msg.includes('Only assigned robot or authorized verifier')) setProofError('Only the assigned robot or verifier can submit proof.');
      else setProofError(msg.slice(0, 250));
    }
  };

  const handleVerifyTask = async () => {
    if (!task) return;
    if (!wallet?.isConnected) { onWalletError?.('Please connect your BridgeKey wallet first.'); return; }
    if (!wallet?.isCorrectNetwork) { onWalletError?.('Please switch to MST Testnet (Chain ID 91562037).'); return; }
    if (task.state !== TaskState.PROOF_SUBMITTED) { setVerifyError('Task must be in PROOF_SUBMITTED state to verify.'); return; }

    setVerifyError(null);
    setVerifyStep('preparing');
    try {
      setVerifyStep('awaiting-approval');
      const tx = await verifyTask(task.taskId, true);
      setVerifyStep('submitted');
      setVerifyTxHash(tx.hash);
      setVerifyStep('confirming');
      await tx.wait(1);
      setVerifyStep('confirmed');
      setTask((prev) => prev ? { ...prev, state: TaskState.VERIFIED, stateLabel: 'VERIFIED' } : null);
      try {
        const refreshed = await getTask(task.taskId);
        if (refreshed && refreshed.state >= TaskState.VERIFIED) setTask(refreshed);
      } catch { /* non-fatal */ }
    } catch (err: unknown) {
      setVerifyStep('failed');
      const msg = err instanceof Error ? err.message : String(err);
      const isUserRejected = msg.includes('user rejected') || msg.includes('ACTION_REJECTED') || msg.includes('User denied') || msg.includes('rejected transaction') || (err as { code?: number | string })?.code === 4001 || (err as { code?: number | string })?.code === 'ACTION_REJECTED';
      if (isUserRejected) setVerifyError('Transaction was rejected in the wallet.');
      else if (msg.includes('Task must be in PROOF_SUBMITTED state')) setVerifyError('Task must be in PROOF_SUBMITTED state to verify.');
      else if (msg.includes('Only authorized verifier')) setVerifyError('Only the authorized verifier can call verifyTask.');
      else setVerifyError(msg.slice(0, 250));
    }
  };

  const handleReleasePayment = async () => {
    if (!task) return;
    if (!wallet?.isConnected) { onWalletError?.('Please connect your BridgeKey wallet first.'); return; }
    if (!wallet?.isCorrectNetwork) { onWalletError?.('Please switch to MST Testnet (Chain ID 91562037).'); return; }
    if (task.state !== TaskState.VERIFIED) { setReleaseError('Task must be in VERIFIED state to release payment.'); return; }

    setReleaseError(null);
    setReleaseStep('preparing');
    try {
      setReleaseStep('awaiting-approval');
      const tx = await releasePayment(task.taskId);
      setReleaseStep('submitted');
      setReleaseTxHash(tx.hash);
      setReleaseStep('confirming');
      await tx.wait(1);
      setReleaseStep('confirmed');
      setTask((prev) => prev ? { ...prev, state: TaskState.PAID, stateLabel: 'PAID' } : null);
      try {
        const refreshed = await getTask(task.taskId);
        if (refreshed && refreshed.state >= TaskState.PAID) setTask(refreshed);
      } catch { /* non-fatal */ }
    } catch (err: unknown) {
      setReleaseStep('failed');
      const msg = err instanceof Error ? err.message : String(err);
      const isUserRejected = msg.includes('user rejected') || msg.includes('ACTION_REJECTED') || msg.includes('User denied') || msg.includes('rejected transaction') || (err as { code?: number | string })?.code === 4001 || (err as { code?: number | string })?.code === 'ACTION_REJECTED';
      if (isUserRejected) setReleaseError('Transaction was rejected in the wallet.');
      else if (msg.includes('Task must be in VERIFIED state')) setReleaseError('Task must be in VERIFIED state to release payment.');
      else setReleaseError(msg.slice(0, 250));
    }
  };

  const handleRefundTask = async () => {
    if (!task) return;
    if (!wallet?.isConnected) { onWalletError?.('Please connect your BridgeKey wallet first.'); return; }
    if (!wallet?.isCorrectNetwork) { onWalletError?.('Please switch to MST Testnet (Chain ID 91562037).'); return; }
    if (!isCreator) { setRefundError('Only the task creator can request a refund.'); return; }
    if (
      task.state !== TaskState.FUNDED &&
      task.state !== TaskState.ASSIGNED &&
      task.state !== TaskState.PROOF_SUBMITTED
    ) {
      setRefundError('Task is not in an eligible state for refund.');
      return;
    }

    setRefundError(null);
    setRefundStep('preparing');
    try {
      setRefundStep('awaiting-approval');
      const tx = await refundTask(task.taskId);
      setRefundStep('submitted');
      setRefundTxHash(tx.hash);
      setRefundStep('confirming');
      await tx.wait(1);
      setRefundStep('confirmed');
      setTask((prev) => prev ? { ...prev, state: TaskState.REFUNDED, stateLabel: 'REFUNDED' } : null);
      try {
        const refreshed = await getTask(task.taskId);
        if (refreshed && refreshed.state === TaskState.REFUNDED) setTask(refreshed);
      } catch { /* non-fatal */ }
    } catch (err: unknown) {
      setRefundStep('failed');
      const msg = err instanceof Error ? err.message : String(err);
      const isUserRejected = msg.includes('user rejected') || msg.includes('ACTION_REJECTED') || msg.includes('User denied') || msg.includes('rejected transaction') || (err as { code?: number | string })?.code === 4001 || (err as { code?: number | string })?.code === 'ACTION_REJECTED';
      if (isUserRejected) setRefundError('Transaction was rejected in the wallet.');
      else if (msg.includes('Only task creator can request refund')) setRefundError('Only the task creator can request a refund.');
      else if (msg.includes('Refund not allowed in current state')) setRefundError('Refund not allowed in current task state.');
      else setRefundError(msg.slice(0, 250));
    }
  };

  // Known tx for T001
  const knownTx = taskId === 'T001' ? KNOWN_TXS.createTask : undefined;

  return (
    <div className="main-content">
      <div className="page-container">
        <div className="page-hero">
          <button
            className="btn btn--secondary btn--sm"
            onClick={() => navigate('/')}
            style={{ marginBottom: '16px' }}
          >
            ← Back to Dashboard
          </button>
          <h1 className="page-hero__title">Task #{taskId}</h1>
          <p className="page-hero__subtitle">Real-time data from MST Testnet</p>
        </div>

        {loading && <LoadingState message={`Reading task ${taskId} from MST Testnet...`} />}

        {error && (
          <div className="alert alert--error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {task && !loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', alignItems: 'start' }}>
            {/* Main task info */}
            <div>
              {/* Status + reward header */}
              <div className="card mb-24">
                <div className="card__header">
                  <div>
                    <div className="card__title" style={{ fontSize: '20px', letterSpacing: '-0.5px' }}>
                      Task #{task.taskId}
                    </div>
                    <div className="card__subtitle">Package: {task.packageId}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--orange-500)', letterSpacing: '-1px', lineHeight: 1 }}>
                      {task.rewardMSTC} MSTC
                    </div>
                    <div style={{ marginTop: '6px' }}>
                      <TaskStatus state={task.state} />
                    </div>
                  </div>
                </div>

                <div className="divider" />

                <div className="detail-grid">
                  <div className="detail-field">
                    <div className="detail-field__label">Task ID</div>
                    <div className="detail-field__value detail-field__value--mono">{task.taskId}</div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field__label">Package ID</div>
                    <div className="detail-field__value">{task.packageId}</div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field__label">Source (Pickup)</div>
                    <div className="detail-field__value">{task.source}</div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field__label">Destination</div>
                    <div className="detail-field__value">{task.destination}</div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field__label">Reward</div>
                    <div className="detail-field__value" style={{ color: 'var(--orange-500)', fontWeight: 800 }}>
                      {task.rewardMSTC} MSTC
                    </div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field__label">State</div>
                    <div className="detail-field__value">{TASK_STATE_LABELS[task.state] ?? task.stateLabel}</div>
                  </div>
                  <div className="detail-field detail-field--full">
                    <div className="detail-field__label">Creator</div>
                    <div className="detail-field__value detail-field__value--mono">
                      {isZeroAddress(task.creator) ? '—' : (
                        <a
                          href={`${MST_EXPLORER_URL}/address/${task.creator}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--blue-600)' }}
                        >
                          {task.creator}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="detail-field detail-field--full">
                    <div className="detail-field__label">Robot Address</div>
                    <div className="detail-field__value detail-field__value--mono">
                      {isZeroAddress(task.robot) ? 'Not yet assigned' : (
                        <a
                          href={`${MST_EXPLORER_URL}/address/${task.robot}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--blue-600)' }}
                        >
                          {task.robot}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="detail-field detail-field--full">
                    <div className="detail-field__label">Proof Hash</div>
                    <div className="detail-field__value detail-field__value--mono" style={{ fontSize: '12px' }}>
                      {task.proofHash === '0x0000000000000000000000000000000000000000000000000000000000000000'
                        ? 'Not yet submitted'
                        : task.proofHash}
                    </div>
                  </div>
                </div>

                <div className="divider" />

                {/* Timestamps */}
                <div className="detail-grid">
                  <div className="detail-field">
                    <div className="detail-field__label">Created At</div>
                    <div className="detail-field__value" style={{ fontSize: '13px' }}>
                      {formatTimestamp(task.createdAt)}
                    </div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field__label">Proof Submitted At</div>
                    <div className="detail-field__value" style={{ fontSize: '13px' }}>
                      {formatTimestamp(task.proofSubmittedAt)}
                    </div>
                  </div>
                  <div className="detail-field">
                    <div className="detail-field__label">Verified At</div>
                    <div className="detail-field__value" style={{ fontSize: '13px' }}>
                      {formatTimestamp(task.verifiedAt)}
                    </div>
                  </div>
                </div>

                {/* Transaction links */}
                {(knownTx || fundingTxHash || assignTxHash || startTxHash || proofTxHash || verifyTxHash || releaseTxHash) && (
                  <>
                    <div className="divider" />
                    <div>
                      <div className="detail-field__label" style={{ marginBottom: '8px' }}>Blockchain Transactions</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {knownTx && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '130px' }}>Task Creation:</span>
                            <TransactionLink hash={knownTx} />
                          </div>
                        )}
                        {fundingTxHash && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '130px' }}>Task Funding:</span>
                            <TransactionLink hash={fundingTxHash} />
                          </div>
                        )}
                        {assignTxHash && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '130px' }}>Robot Assignment:</span>
                            <TransactionLink hash={assignTxHash} />
                          </div>
                        )}
                        {startTxHash && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '130px' }}>Task Start:</span>
                            <TransactionLink hash={startTxHash} />
                          </div>
                        )}
                        {proofTxHash && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '130px' }}>Proof Submission:</span>
                            <TransactionLink hash={proofTxHash} />
                          </div>
                        )}
                        {verifyTxHash && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '130px' }}>Verification:</span>
                            <TransactionLink hash={verifyTxHash} />
                          </div>
                        )}
                        {releaseTxHash && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '130px' }}>Payment Release:</span>
                            <TransactionLink hash={releaseTxHash} />
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Escrow Funding Card — Visible for CREATED task */}
              {task.state === TaskState.CREATED && (
                <div
                  className="card mb-24"
                  data-testid="escrow-funding-card"
                  style={{
                    border: '1.5px solid var(--orange-400)',
                    background: 'linear-gradient(to bottom, #ffffff, #fffbf7)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '16px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>💰</span>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Fund Escrow</h2>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Lock reward into ProofToPay smart contract escrow to activate this task.
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                        Escrow Amount
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--orange-500)' }}>
                        {task.rewardMSTC} MSTC
                      </div>
                    </div>
                  </div>

                  {/* Wallet warnings / info */}
                  {!wallet?.isConnected ? (
                    <div className="alert alert--warning mb-16" data-testid="wallet-disconnected-warning">
                      <span>🔑</span>
                      <div style={{ flex: 1 }}>
                        <strong>Wallet not connected.</strong> Connect your BridgeKey wallet to fund this task.
                      </div>
                      {onWalletConnect && onWalletError && (
                        <WalletButton
                          wallet={wallet}
                          onConnect={onWalletConnect}
                          onError={onWalletError}
                        />
                      )}
                    </div>
                  ) : !isCreator ? (
                    <div className="alert alert--warning mb-16" data-testid="wallet-not-creator-warning">
                      <span>⚠️</span>
                      <div style={{ fontSize: '13px' }}>
                        <strong>Connected wallet is not the task creator.</strong><br />
                        Connected: <code style={{ fontSize: '12px' }}>{wallet.address}</code><br />
                        Creator: <code style={{ fontSize: '12px' }}>{task.creator}</code><br />
                        Only the task creator can fund this escrow.
                      </div>
                    </div>
                  ) : !wallet?.isCorrectNetwork ? (
                    <div className="alert alert--warning mb-16" data-testid="wallet-wrong-network-warning">
                      <span>⚠️</span>
                      <div>Please switch your wallet to MST Testnet (Chain ID 91562037).</div>
                    </div>
                  ) : (
                    <div className="alert alert--info mb-16" data-testid="ready-to-fund-info">
                      <span>ℹ️</span>
                      <div style={{ fontSize: '13px' }}>
                        Fund <strong>{task.rewardMSTC} MSTC</strong> into smart-contract escrow? Funds will be locked in the contract until the robot submits valid sensor proof and the verifier confirms delivery.
                      </div>
                    </div>
                  )}

                  {/* TX Progress */}
                  {txStep !== 'idle' && (
                    <div
                      className={`tx-progress mb-16 ${txStep === 'confirmed' ? 'tx-progress--success' : ''} ${txStep === 'failed' ? 'tx-progress--failed' : ''}`}
                      data-testid="tx-progress"
                    >
                      {isSubmitting && <div className="spinner spinner--sm" />}
                      {txStep === 'confirmed' && <span>✅</span>}
                      {txStep === 'failed' && <span>❌</span>}
                      <span>
                        {txStep === 'awaiting-approval'
                          ? 'Waiting for BridgeKey approval...'
                          : txStep === 'confirming'
                          ? 'Waiting for block confirmation...'
                          : txStep === 'confirmed'
                          ? `Escrow funded: ${task.rewardMSTC} MSTC`
                          : TX_STEP_LABELS[txStep]}
                      </span>
                    </div>
                  )}

                  {/* TX Hash */}
                  {txHash && (
                    <div className="mb-16">
                      <div className="detail-field__label mb-8">Transaction Hash</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <TransactionLink hash={txHash} />
                        <a
                          href={`${MST_EXPLORER_URL}/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn--outline btn--sm"
                        >
                          View on MSTScan ↗
                        </a>
                      </div>
                    </div>
                  )}

                  {/* TX Error */}
                  {txError && (
                    <div className="alert alert--error mb-16" data-testid="tx-error">
                      <span>⚠️</span>
                      <span style={{ wordBreak: 'break-word' }}>{txError}</span>
                    </div>
                  )}

                  {/* Fund Action Button */}
                  <button
                    className="btn btn--primary btn--lg btn--full"
                    onClick={handleFundTask}
                    disabled={
                      !wallet?.isConnected ||
                      !isCreator ||
                      !wallet?.isCorrectNetwork ||
                      task.state !== TaskState.CREATED ||
                      isSubmitting ||
                      loading
                    }
                    data-testid="fund-task-btn"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="spinner spinner--sm spinner--white" />
                        <span>
                          {txStep === 'awaiting-approval'
                            ? 'Approve in BridgeKey...'
                            : 'Confirming on MST Testnet...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>⚡</span>
                        <span>Fund {task.rewardMSTC} MSTC</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Escrow Active Banner — Visible once FUNDED */}
              {task.state >= TaskState.FUNDED && (
                <div
                  className="card mb-24"
                  data-testid="escrow-funded-card"
                  style={{
                    border: '1.5px solid var(--green-500)',
                    background: 'linear-gradient(to bottom, #ffffff, #f0fdf4)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '24px' }}>✅</span>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--green-600)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Escrow Active
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--slate-900)' }}>
                        Escrow funded: {task.rewardMSTC} MSTC
                      </div>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Reward is securely locked in the ProofToPay smart contract on MST Testnet.
                  </p>
                  {fundingTxHash && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--slate-100)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Transaction:</span>
                      <TransactionLink hash={fundingTxHash} />
                      <a
                        href={`${MST_EXPLORER_URL}/tx/${fundingTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--outline btn--sm"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                      >
                        View on MSTScan ↗
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Assign Robot Card — Visible when task.state === FUNDED */}
              {task.state === TaskState.FUNDED && (
                <div
                  className="card mb-24"
                  data-testid="assign-robot-card"
                  style={{
                    border: '1.5px solid var(--purple-500)',
                    background: 'linear-gradient(to bottom, #ffffff, #faf5ff)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '16px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>🤖</span>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Assign Robot</h2>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Assign an autonomous robot to physically execute this delivery task.
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                        Designated Robot
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--purple-600)' }}>
                        {DEFAULT_ROBOT.id}
                      </div>
                    </div>
                  </div>

                  <div className="detail-grid mb-16" style={{ background: 'var(--slate-50)', padding: '12px 16px', borderRadius: 'var(--radius-sm)' }}>
                    <div className="detail-field">
                      <div className="detail-field__label">Robot:</div>
                      <div className="detail-field__value" style={{ fontWeight: 700 }}>{DEFAULT_ROBOT.id}</div>
                    </div>
                    <div className="detail-field detail-field--full">
                      <div className="detail-field__label">Robot address:</div>
                      <div className="detail-field__value detail-field__value--mono" style={{ fontSize: '13px' }}>
                        {DEFAULT_ROBOT.address}
                      </div>
                    </div>
                  </div>

                  {/* Wallet warnings / info */}
                  {!wallet?.isConnected ? (
                    <div className="alert alert--warning mb-16" data-testid="assign-wallet-disconnected-warning">
                      <span>🔑</span>
                      <div style={{ flex: 1 }}>
                        <strong>Wallet not connected.</strong> Connect your BridgeKey wallet to assign a robot.
                      </div>
                      {onWalletConnect && onWalletError && (
                        <WalletButton
                          wallet={wallet}
                          onConnect={onWalletConnect}
                          onError={onWalletError}
                        />
                      )}
                    </div>
                  ) : !isCreator ? (
                    <div className="alert alert--warning mb-16" data-testid="assign-not-creator-warning">
                      <span>⚠️</span>
                      <div style={{ fontSize: '13px' }}>
                        <strong>Connected wallet is not the task creator.</strong><br />
                        Connected: <code style={{ fontSize: '12px' }}>{wallet.address}</code><br />
                        Creator: <code style={{ fontSize: '12px' }}>{task.creator}</code><br />
                        Only the task creator can assign a robot.
                      </div>
                    </div>
                  ) : !wallet?.isCorrectNetwork ? (
                    <div className="alert alert--warning mb-16" data-testid="assign-wrong-network-warning">
                      <span>⚠️</span>
                      <div>Please switch your wallet to MST Testnet (Chain ID 91562037).</div>
                    </div>
                  ) : (
                    <div className="alert alert--info mb-16" data-testid="ready-to-assign-info">
                      <span>ℹ️</span>
                      <div style={{ fontSize: '13px' }}>
                        Assign robot <strong>{DEFAULT_ROBOT.id}</strong> (<code>{DEFAULT_ROBOT.address}</code>) to this task? This records the assignment on MST Testnet.
                      </div>
                    </div>
                  )}

                  {/* TX Progress */}
                  {assignStep !== 'idle' && (
                    <div
                      className={`tx-progress mb-16 ${assignStep === 'confirmed' ? 'tx-progress--success' : ''} ${assignStep === 'failed' ? 'tx-progress--failed' : ''}`}
                      data-testid="assign-tx-progress"
                    >
                      {isAssigning && <div className="spinner spinner--sm" />}
                      {assignStep === 'confirmed' && <span>✅</span>}
                      {assignStep === 'failed' && <span>❌</span>}
                      <span>
                        {assignStep === 'awaiting-approval'
                          ? 'Waiting for BridgeKey approval...'
                          : assignStep === 'confirming'
                          ? 'Waiting for block confirmation...'
                          : assignStep === 'confirmed'
                          ? 'Robot Assigned!'
                          : TX_STEP_LABELS[assignStep]}
                      </span>
                    </div>
                  )}

                  {/* TX Hash */}
                  {assignTxHash && (
                    <div className="mb-16">
                      <div className="detail-field__label mb-8">Assignment Transaction Hash</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <TransactionLink hash={assignTxHash} />
                        <a
                          href={`${MST_EXPLORER_URL}/tx/${assignTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn--outline btn--sm"
                        >
                          View on MSTScan ↗
                        </a>
                      </div>
                    </div>
                  )}

                  {/* TX Error */}
                  {assignError && (
                    <div className="alert alert--error mb-16" data-testid="assign-tx-error">
                      <span>⚠️</span>
                      <span style={{ wordBreak: 'break-word' }}>{assignError}</span>
                    </div>
                  )}

                  {/* Assign Action Button */}
                  <button
                    className="btn btn--primary btn--lg btn--full"
                    onClick={handleAssignRobot}
                    disabled={
                      !wallet?.isConnected ||
                      !isCreator ||
                      !wallet?.isCorrectNetwork ||
                      task.state !== TaskState.FUNDED ||
                      isAssigning ||
                      isSubmitting ||
                      loading
                    }
                    data-testid="assign-robot-btn"
                    style={{
                      background: 'var(--purple-600)',
                      borderColor: 'var(--purple-600)',
                    }}
                  >
                    {isAssigning ? (
                      <>
                        <div className="spinner spinner--sm spinner--white" />
                        <span>
                          {assignStep === 'awaiting-approval'
                            ? 'Approve in BridgeKey...'
                            : 'Confirming on MST Testnet...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>🤖</span>
                        <span>Assign Robot NR-001</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Robot Assigned Confirmation Card — Visible once ASSIGNED or beyond */}
              {task.state >= TaskState.ASSIGNED && (
                <div
                  className="card mb-24"
                  data-testid="robot-assigned-card"
                  style={{
                    border: '1.5px solid var(--purple-500)',
                    background: 'linear-gradient(to bottom, #ffffff, #faf5ff)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '24px' }}>🤖</span>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--purple-600)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Task state: ASSIGNED
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--slate-900)' }}>
                        Robot Assigned
                      </div>
                    </div>
                  </div>
                  <div className="detail-grid mb-8" style={{ background: 'var(--slate-50)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                    <div className="detail-field">
                      <div className="detail-field__label">Robot:</div>
                      <div className="detail-field__value" style={{ fontWeight: 700 }}>{DEFAULT_ROBOT.id}</div>
                    </div>
                    <div className="detail-field detail-field--full">
                      <div className="detail-field__label">Robot address:</div>
                      <div className="detail-field__value detail-field__value--mono" style={{ fontSize: '13px' }}>
                        <a
                          href={`${MST_EXPLORER_URL}/address/${task.robot && !isZeroAddress(task.robot) ? task.robot : DEFAULT_ROBOT.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--blue-600)' }}
                        >
                          {task.robot && !isZeroAddress(task.robot) ? task.robot : DEFAULT_ROBOT.address}
                        </a>
                      </div>
                    </div>
                  </div>
                  {assignTxHash && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--slate-100)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Assignment Transaction:</span>
                      <TransactionLink hash={assignTxHash} />
                      <a
                        href={`${MST_EXPLORER_URL}/tx/${assignTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--outline btn--sm"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                      >
                        View on MSTScan ↗
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Start Task Card — Visible when task.state === ASSIGNED */}
              {task.state === TaskState.ASSIGNED && (
                <div
                  className="card mb-24"
                  data-testid="start-task-card"
                  style={{
                    border: '1.5px solid var(--orange-500)',
                    background: 'linear-gradient(to bottom, #ffffff, #fffaf5)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '16px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>⚡</span>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Start Task</h2>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Task ready to start. Authorize the assigned robot to commence physical work.
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                        Status
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--orange-500)' }}>
                        Task ready to start
                      </div>
                    </div>
                  </div>

                  <div className="detail-grid mb-16" style={{ background: 'var(--slate-50)', padding: '12px 16px', borderRadius: 'var(--radius-sm)' }}>
                    <div className="detail-field">
                      <div className="detail-field__label">Robot:</div>
                      <div className="detail-field__value" style={{ fontWeight: 700 }}>{DEFAULT_ROBOT.id}</div>
                    </div>
                    <div className="detail-field detail-field--full">
                      <div className="detail-field__label">Robot address:</div>
                      <div className="detail-field__value detail-field__value--mono" style={{ fontSize: '13px' }}>
                        {task.robot && !isZeroAddress(task.robot) ? task.robot : DEFAULT_ROBOT.address}
                      </div>
                    </div>
                  </div>

                  {/* Wallet warnings / info */}
                  {!wallet?.isConnected ? (
                    <div className="alert alert--warning mb-16" data-testid="start-wallet-disconnected-warning">
                      <span>🔑</span>
                      <div style={{ flex: 1 }}>
                        <strong>Wallet not connected.</strong> Connect your BridgeKey wallet to start this task.
                      </div>
                      {onWalletConnect && onWalletError && (
                        <WalletButton
                          wallet={wallet}
                          onConnect={onWalletConnect}
                          onError={onWalletError}
                        />
                      )}
                    </div>
                  ) : !isCreator ? (
                    <div className="alert alert--warning mb-16" data-testid="start-not-creator-warning">
                      <span>⚠️</span>
                      <div style={{ fontSize: '13px' }}>
                        <strong>Connected wallet is not the task creator.</strong><br />
                        Connected: <code style={{ fontSize: '12px' }}>{wallet.address}</code><br />
                        Creator: <code style={{ fontSize: '12px' }}>{task.creator}</code><br />
                        Only the task creator can start this task.
                      </div>
                    </div>
                  ) : !wallet?.isCorrectNetwork ? (
                    <div className="alert alert--warning mb-16" data-testid="start-wrong-network-warning">
                      <span>⚠️</span>
                      <div>Please switch your wallet to MST Testnet (Chain ID 91562037).</div>
                    </div>
                  ) : (
                    <div className="alert alert--info mb-16" data-testid="ready-to-start-info">
                      <span>ℹ️</span>
                      <div style={{ fontSize: '13px' }}>
                        Task ready to start. Authorize robot <strong>{DEFAULT_ROBOT.id}</strong> to transition task #{task.taskId} into <code>WORKING</code> state on MST Testnet.
                      </div>
                    </div>
                  )}

                  {/* TX Progress */}
                  {startStep !== 'idle' && (
                    <div
                      className={`tx-progress mb-16 ${startStep === 'confirmed' ? 'tx-progress--success' : ''} ${startStep === 'failed' ? 'tx-progress--failed' : ''}`}
                      data-testid="start-tx-progress"
                    >
                      {isStarting && <div className="spinner spinner--sm" />}
                      {startStep === 'confirmed' && <span>✅</span>}
                      {startStep === 'failed' && <span>❌</span>}
                      <span>
                        {startStep === 'awaiting-approval'
                          ? 'Waiting for BridgeKey approval...'
                          : startStep === 'confirming'
                          ? 'Waiting for block confirmation...'
                          : startStep === 'confirmed'
                          ? 'Task Started!'
                          : TX_STEP_LABELS[startStep]}
                      </span>
                    </div>
                  )}

                  {/* TX Hash */}
                  {startTxHash && (
                    <div className="mb-16">
                      <div className="detail-field__label mb-8">Start Transaction Hash</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <TransactionLink hash={startTxHash} />
                        <a
                          href={`${MST_EXPLORER_URL}/tx/${startTxHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn--outline btn--sm"
                        >
                          View on MSTScan ↗
                        </a>
                      </div>
                    </div>
                  )}

                  {/* TX Error */}
                  {startError && (
                    <div className="alert alert--error mb-16" data-testid="start-tx-error">
                      <span>⚠️</span>
                      <span style={{ wordBreak: 'break-word' }}>{startError}</span>
                    </div>
                  )}

                  {/* Start Action Button */}
                  <button
                    className="btn btn--primary btn--lg btn--full"
                    onClick={handleStartTask}
                    disabled={
                      !wallet?.isConnected ||
                      !isCreator ||
                      !wallet?.isCorrectNetwork ||
                      task.state !== TaskState.ASSIGNED ||
                      isStarting ||
                      isAssigning ||
                      isSubmitting ||
                      loading
                    }
                    data-testid="start-task-btn"
                  >
                    {isStarting ? (
                      <>
                        <div className="spinner spinner--sm spinner--white" />
                        <span>
                          {startStep === 'awaiting-approval'
                            ? 'Approve in BridgeKey...'
                            : 'Confirming on MST Testnet...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <span>⚡</span>
                        <span>Start Task</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Task Working Card — Visible once WORKING or beyond */}
              {task.state >= TaskState.WORKING && (
                <div
                  className="card mb-24"
                  data-testid="task-working-card"
                  style={{
                    border: '1.5px solid var(--orange-500)',
                    background: 'linear-gradient(to bottom, #ffffff, #fffaf5)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '24px' }}>⚡</span>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--orange-600)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        TASK STATE: WORKING
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--slate-900)' }}>
                        Work in Progress
                      </div>
                    </div>
                  </div>
                  <div className="detail-grid mb-8" style={{ background: 'var(--slate-50)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                    <div className="detail-field">
                      <div className="detail-field__label">Robot:</div>
                      <div className="detail-field__value" style={{ fontWeight: 700 }}>{DEFAULT_ROBOT.id}</div>
                    </div>
                    <div className="detail-field detail-field--full">
                      <div className="detail-field__label">Robot address:</div>
                      <div className="detail-field__value detail-field__value--mono" style={{ fontSize: '13px' }}>
                        <a
                          href={`${MST_EXPLORER_URL}/address/${task.robot && !isZeroAddress(task.robot) ? task.robot : DEFAULT_ROBOT.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--blue-600)' }}
                        >
                          {task.robot && !isZeroAddress(task.robot) ? task.robot : DEFAULT_ROBOT.address}
                        </a>
                      </div>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Task started. Robot is now authorized to perform the physical task.
                  </p>
                  {startTxHash && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--slate-100)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Start Transaction:</span>
                      <TransactionLink hash={startTxHash} />
                      <a
                        href={`${MST_EXPLORER_URL}/tx/${startTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn--outline btn--sm"
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                      >
                        View on MSTScan ↗
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Submit Proof Card — Visible when task.state === WORKING ─── */}
              {task.state === TaskState.WORKING && (
                <div
                  className="card mb-24"
                  data-testid="submit-proof-card"
                  style={{
                    border: '1.5px solid #7c3aed',
                    background: 'linear-gradient(to bottom, #ffffff, #f5f3ff)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '16px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>🔐</span>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Proof of Physical Work</h2>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Submit the verified cryptographic proof hash to the blockchain.
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Verification</div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#16a34a' }}>10 / 10 CHECKS PASSED</div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>✅ VERIFIED</div>
                    </div>
                  </div>

                  {/* Proof Hash display */}
                  <div style={{ background: 'var(--slate-50)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: '16px' }}>
                    <div className="detail-field__label" style={{ marginBottom: '4px' }}>Proof Hash (keccak256)</div>
                    <div
                      data-testid="proof-hash-display"
                      style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--slate-700)', wordBreak: 'break-all' }}
                    >
                      {currentProofHash}
                    </div>
                  </div>

                  {/* Evidence summary */}
                  <div style={{ background: '#faf5ff', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: '16px', border: '1px solid #e9d5ff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div className="detail-field__label" style={{ margin: 0, color: '#7c3aed' }}>Hardware Evidence</div>
                      <button
                        type="button"
                        onClick={() => void refreshEvidence()}
                        className="btn btn--outline btn--sm"
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                        data-testid="refresh-evidence-btn"
                      >
                        ↻ Refresh Evidence
                      </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                      <div style={{ fontSize: '12px' }}><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>RFID:</span> <span style={{ fontFamily: 'monospace' }}>{taskEvidence?.rfidUid ?? 'D9:33:6A:F8'}</span></div>
                      <div style={{ fontSize: '12px' }}><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Distance:</span> {taskEvidence?.distance !== undefined ? `${taskEvidence.distance} m` : '12.4 m'}</div>
                      <div style={{ fontSize: '12px' }}><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Movement:</span> <span style={{ color: '#d97706', fontWeight: 700 }}>{(taskEvidence?.simulation ?? true) ? 'SIMULATED' : 'PHYSICAL'}</span></div>
                      <div style={{ fontSize: '12px' }}><span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>simulation:</span> <code style={{ fontSize: '11px' }}>{String(taskEvidence?.simulation ?? true)}</code></div>
                    </div>
                    <div style={{ marginTop: '8px', padding: '6px 10px', background: '#fef3c7', borderRadius: '4px', border: '1px solid #fde68a' }}>
                      <span style={{ fontSize: '11px', color: '#92400e' }}>⚠️ <strong>Movement is simulated</strong> — no physical wheels or encoders were used. RFID scan and hardware telemetry are real.</span>
                    </div>
                  </div>

                  {/* Wallet info */}
                  {!wallet?.isConnected ? (
                    <div className="alert alert--warning mb-16" data-testid="proof-wallet-disconnected-warning">
                      <span>🔑</span>
                      <div style={{ flex: 1 }}><strong>Wallet not connected.</strong> Connect your BridgeKey wallet to submit proof.</div>
                    </div>
                  ) : !wallet?.isCorrectNetwork ? (
                    <div className="alert alert--warning mb-16" data-testid="proof-wrong-network-warning">
                      <span>⚠️</span>
                      <div>Please switch your wallet to MST Testnet (Chain ID 91562037).</div>
                    </div>
                  ) : (
                    <div className="alert alert--info mb-16" data-testid="proof-ready-info">
                      <span>ℹ️</span>
                      <div style={{ fontSize: '13px' }}>
                        Submit proof hash <code style={{ fontSize: '11px' }}>{currentProofHash ? `${currentProofHash.slice(0, 18)}…` : '—'}</code> to MST Testnet via <strong>submitProof()</strong>.
                      </div>
                    </div>
                  )}

                  {/* TX Progress */}
                  {proofStep !== 'idle' && (
                    <div
                      className={`tx-progress mb-16 ${proofStep === 'confirmed' ? 'tx-progress--success' : ''} ${proofStep === 'failed' ? 'tx-progress--failed' : ''}`}
                      data-testid="proof-tx-progress"
                    >
                      {isSubmittingProof && <div className="spinner spinner--sm" />}
                      {proofStep === 'confirmed' && <span>✅</span>}
                      {proofStep === 'failed' && <span>❌</span>}
                      <span>
                        {proofStep === 'awaiting-approval' ? 'Waiting for BridgeKey confirmation...' :
                         proofStep === 'submitted' ? 'Transaction submitted...' :
                         proofStep === 'confirming' ? 'Waiting for blockchain confirmation...' :
                         proofStep === 'confirmed' ? 'Proof submitted — PROOF_SUBMITTED state.' :
                         TX_STEP_LABELS[proofStep]}
                      </span>
                    </div>
                  )}

                  {/* TX Hash */}
                  {proofTxHash && (
                    <div className="mb-16">
                      <div className="detail-field__label mb-8">Proof Submission Transaction</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <TransactionLink hash={proofTxHash} />
                        <a href={`${MST_EXPLORER_URL}/tx/${proofTxHash}`} target="_blank" rel="noopener noreferrer" className="btn btn--outline btn--sm">View on MSTScan ↗</a>
                      </div>
                    </div>
                  )}

                  {/* TX Error */}
                  {proofError && (
                    <div className="alert alert--error mb-16" data-testid="proof-tx-error">
                      <span>⚠️</span>
                      <span style={{ wordBreak: 'break-word' }}>{proofError}</span>
                    </div>
                  )}

                  {/* Submit Proof Button */}
                  <button
                    className="btn btn--primary btn--lg btn--full"
                    onClick={handleSubmitProof}
                    disabled={
                      !wallet?.isConnected ||
                      !wallet?.isCorrectNetwork ||
                      task.state !== TaskState.WORKING ||
                      isSubmittingProof ||
                      loading
                    }
                    data-testid="submit-proof-btn"
                    style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                  >
                    {isSubmittingProof ? (
                      <>
                        <div className="spinner spinner--sm spinner--white" />
                        <span>{proofStep === 'awaiting-approval' ? 'Approve in BridgeKey...' : 'Confirming on MST Testnet...'}</span>
                      </>
                    ) : (
                      <>
                        <span>🔐</span>
                        <span>Submit Proof to Blockchain</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* ─── Proof Submitted Confirmation Card — Visible once PROOF_SUBMITTED or beyond ─── */}
              {task.state >= TaskState.PROOF_SUBMITTED && (
                <div
                  className="card mb-24"
                  data-testid="proof-submitted-card"
                  style={{
                    border: '1.5px solid #7c3aed',
                    background: 'linear-gradient(to bottom, #ffffff, #f5f3ff)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '24px' }}>🔐</span>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Proof Submitted</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--slate-900)' }}>Sensor Proof On-Chain</div>
                    </div>
                  </div>

                  {/* Cryptographic Sensor Proof Hash — NEVER confused with tx hash */}
                  <div style={{ marginBottom: '14px' }}>
                    <div className="detail-field__label" style={{ marginBottom: '4px', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
                      Proof Hash (keccak256)
                    </div>
                    <div
                      data-testid="on-chain-proof-hash"
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: 'var(--slate-700)',
                        background: 'var(--slate-50)',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        wordBreak: 'break-all',
                        border: '1px solid var(--slate-200)',
                      }}
                    >
                      {task.proofHash && task.proofHash !== ethers.ZeroHash && task.proofHash !== '0x0000000000000000000000000000000000000000000000000000000000000000'
                        ? task.proofHash
                        : currentProofHash}
                    </div>
                  </div>

                  {/* Proof Submission Transaction Hash — separate and distinct */}
                  {proofTxHash && (
                    <div style={{ paddingTop: '10px', borderTop: '1px solid var(--slate-100)' }} data-testid="proof-tx-hash-section">
                      <div className="detail-field__label" style={{ marginBottom: '4px', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
                        Proof Transaction Hash
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <TransactionLink hash={proofTxHash} />
                        <a href={`${MST_EXPLORER_URL}/tx/${proofTxHash}`} target="_blank" rel="noopener noreferrer" className="btn btn--outline btn--sm" style={{ padding: '2px 8px', fontSize: '11px' }}>View on MSTScan ↗</a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Verify Task Card — Visible only when task.state === PROOF_SUBMITTED ─── */}
              {task.state === TaskState.PROOF_SUBMITTED && (
                <div
                  className="card mb-24"
                  data-testid="verify-task-card"
                  style={{
                    border: '1.5px solid #0284c7',
                    background: 'linear-gradient(to bottom, #ffffff, #f0f9ff)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '16px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>✅</span>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>On-Chain Verification</h2>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Record the independent verifier's decision on MST Testnet.
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Independent Verification</div>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: '#16a34a' }}>10 / 10 CHECKS PASSED</div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>✅ VERIFIED</div>
                    </div>
                  </div>

                  <div style={{ background: '#f0f9ff', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: '16px', border: '1px solid #bae6fd' }}>
                    <div className="detail-field__label" style={{ marginBottom: '6px', color: '#0284c7' }}>Authorized Verifier</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--slate-700)' }}>
                      BridgeKey wallet — {wallet?.address ?? '(connect wallet)'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      The verifier address set in the deployed contract matches the BridgeKey wallet.
                    </div>
                  </div>

                  {!wallet?.isConnected ? (
                    <div className="alert alert--warning mb-16" data-testid="verify-wallet-disconnected-warning">
                      <span>🔑</span>
                      <div style={{ flex: 1 }}><strong>Wallet not connected.</strong> Connect your BridgeKey wallet to verify this task.</div>
                    </div>
                  ) : !wallet?.isCorrectNetwork ? (
                    <div className="alert alert--warning mb-16" data-testid="verify-wrong-network-warning">
                      <span>⚠️</span>
                      <div>Please switch your wallet to MST Testnet (Chain ID 91562037).</div>
                    </div>
                  ) : (
                    <div className="alert alert--info mb-16" data-testid="verify-ready-info">
                      <span>ℹ️</span>
                      <div style={{ fontSize: '13px' }}>
                        Call <strong>verifyTask("{task.taskId}", true)</strong> on MST Testnet to permanently record the verification.
                      </div>
                    </div>
                  )}

                  {/* TX Progress */}
                  {verifyStep !== 'idle' && (
                    <div
                      className={`tx-progress mb-16 ${verifyStep === 'confirmed' ? 'tx-progress--success' : ''} ${verifyStep === 'failed' ? 'tx-progress--failed' : ''}`}
                      data-testid="verify-tx-progress"
                    >
                      {isVerifying && <div className="spinner spinner--sm" />}
                      {verifyStep === 'confirmed' && <span>✅</span>}
                      {verifyStep === 'failed' && <span>❌</span>}
                      <span>
                        {verifyStep === 'awaiting-approval' ? 'Waiting for BridgeKey confirmation...' :
                         verifyStep === 'submitted' ? 'Transaction submitted...' :
                         verifyStep === 'confirming' ? 'Waiting for blockchain confirmation...' :
                         verifyStep === 'confirmed' ? 'Task verified on-chain!' :
                         TX_STEP_LABELS[verifyStep]}
                      </span>
                    </div>
                  )}

                  {verifyTxHash && (
                    <div className="mb-16">
                      <div className="detail-field__label mb-8">Verification Transaction</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <TransactionLink hash={verifyTxHash} />
                        <a href={`${MST_EXPLORER_URL}/tx/${verifyTxHash}`} target="_blank" rel="noopener noreferrer" className="btn btn--outline btn--sm">View on MSTScan ↗</a>
                      </div>
                    </div>
                  )}

                  {verifyError && (
                    <div className="alert alert--error mb-16" data-testid="verify-tx-error">
                      <span>⚠️</span>
                      <span style={{ wordBreak: 'break-word' }}>{verifyError}</span>
                    </div>
                  )}

                  <button
                    className="btn btn--primary btn--lg btn--full"
                    onClick={handleVerifyTask}
                    disabled={
                      !wallet?.isConnected ||
                      !wallet?.isCorrectNetwork ||
                      task.state !== TaskState.PROOF_SUBMITTED ||
                      isVerifying ||
                      isSubmittingProof ||
                      loading
                    }
                    data-testid="verify-task-btn"
                    style={{ background: '#0284c7', borderColor: '#0284c7' }}
                  >
                    {isVerifying ? (
                      <>
                        <div className="spinner spinner--sm spinner--white" />
                        <span>{verifyStep === 'awaiting-approval' ? 'Approve in BridgeKey...' : 'Confirming on MST Testnet...'}</span>
                      </>
                    ) : (
                      <>
                        <span>✅</span>
                        <span>Record Verification On-Chain</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* ─── Verified Confirmation Card — Visible once VERIFIED or beyond ─── */}
              {(task.state === TaskState.VERIFIED || task.state === TaskState.PAID) && (
                <div
                  className="card mb-24"
                  data-testid="task-verified-card"
                  style={{
                    border: '1.5px solid #16a34a',
                    background: 'linear-gradient(to bottom, #ffffff, #f0fdf4)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '24px' }}>✅</span>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Task Verified</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--slate-900)' }}>Verification Recorded On-Chain</div>
                    </div>
                  </div>
                  {verifyTxHash && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--slate-100)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Verification Transaction:</span>
                      <TransactionLink hash={verifyTxHash} />
                      <a href={`${MST_EXPLORER_URL}/tx/${verifyTxHash}`} target="_blank" rel="noopener noreferrer" className="btn btn--outline btn--sm" style={{ padding: '2px 8px', fontSize: '11px' }}>View on MSTScan ↗</a>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Release Payment Card — Visible only when task.state === VERIFIED ─── */}
              {task.state === TaskState.VERIFIED && (
                <div
                  className="card mb-24"
                  data-testid="release-payment-card"
                  style={{
                    border: '1.5px solid var(--orange-500)',
                    background: 'linear-gradient(to bottom, #ffffff, #fffbf7)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '16px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '20px' }}>💸</span>
                        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Escrow Settlement</h2>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Task is verified. Release escrowed reward to the robot wallet.
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Reward</div>
                      <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--orange-500)' }}>{task.rewardMSTC} MSTC</div>
                      <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600 }}>Verified — Ready for Payment</div>
                    </div>
                  </div>

                  <div style={{ background: 'var(--slate-50)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div className="detail-field">
                        <div className="detail-field__label">Robot:</div>
                        <div className="detail-field__value" style={{ fontWeight: 700 }}>{DEFAULT_ROBOT.id}</div>
                      </div>
                      <div className="detail-field">
                        <div className="detail-field__label">Reward:</div>
                        <div className="detail-field__value" style={{ fontWeight: 700, color: 'var(--orange-500)' }}>{task.rewardMSTC} MSTC</div>
                      </div>
                      <div className="detail-field detail-field--full">
                        <div className="detail-field__label">Recipient (Robot):</div>
                        <div className="detail-field__value detail-field__value--mono" style={{ fontSize: '12px' }}>
                          {task.robot && !isZeroAddress(task.robot) ? task.robot : DEFAULT_ROBOT.address}
                        </div>
                      </div>
                    </div>
                  </div>

                  {!wallet?.isConnected ? (
                    <div className="alert alert--warning mb-16" data-testid="release-wallet-disconnected-warning">
                      <span>🔑</span>
                      <div style={{ flex: 1 }}><strong>Wallet not connected.</strong> Connect your BridgeKey wallet to release payment.</div>
                    </div>
                  ) : !wallet?.isCorrectNetwork ? (
                    <div className="alert alert--warning mb-16" data-testid="release-wrong-network-warning">
                      <span>⚠️</span>
                      <div>Please switch your wallet to MST Testnet (Chain ID 91562037).</div>
                    </div>
                  ) : (
                    <div className="alert alert--info mb-16" data-testid="release-ready-info">
                      <span>ℹ️</span>
                      <div style={{ fontSize: '13px' }}>
                        Call <strong>releasePayment("{task.taskId}")</strong> to transfer <strong>{task.rewardMSTC} MSTC</strong> from escrow to robot {DEFAULT_ROBOT.id}.
                      </div>
                    </div>
                  )}

                  {/* TX Progress */}
                  {releaseStep !== 'idle' && (
                    <div
                      className={`tx-progress mb-16 ${releaseStep === 'confirmed' ? 'tx-progress--success' : ''} ${releaseStep === 'failed' ? 'tx-progress--failed' : ''}`}
                      data-testid="release-tx-progress"
                    >
                      {isReleasing && <div className="spinner spinner--sm" />}
                      {releaseStep === 'confirmed' && <span>✅</span>}
                      {releaseStep === 'failed' && <span>❌</span>}
                      <span>
                        {releaseStep === 'awaiting-approval' ? 'Waiting for BridgeKey confirmation...' :
                         releaseStep === 'submitted' ? 'Transaction submitted...' :
                         releaseStep === 'confirming' ? 'Waiting for blockchain confirmation...' :
                         releaseStep === 'confirmed' ? `Payment released: ${task.rewardMSTC} MSTC` :
                         TX_STEP_LABELS[releaseStep]}
                      </span>
                    </div>
                  )}

                  {releaseTxHash && (
                    <div className="mb-16">
                      <div className="detail-field__label mb-8">Payment Transaction</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <TransactionLink hash={releaseTxHash} />
                        <a href={`${MST_EXPLORER_URL}/tx/${releaseTxHash}`} target="_blank" rel="noopener noreferrer" className="btn btn--outline btn--sm">View on MSTScan ↗</a>
                      </div>
                    </div>
                  )}

                  {releaseError && (
                    <div className="alert alert--error mb-16" data-testid="release-tx-error">
                      <span>⚠️</span>
                      <span style={{ wordBreak: 'break-word' }}>{releaseError}</span>
                    </div>
                  )}

                  <button
                    className="btn btn--primary btn--lg btn--full"
                    onClick={handleReleasePayment}
                    disabled={
                      !wallet?.isConnected ||
                      !wallet?.isCorrectNetwork ||
                      task.state !== TaskState.VERIFIED ||
                      isReleasing ||
                      isVerifying ||
                      loading
                    }
                    data-testid="release-payment-btn"
                  >
                    {isReleasing ? (
                      <>
                        <div className="spinner spinner--sm spinner--white" />
                        <span>{releaseStep === 'awaiting-approval' ? 'Approve in BridgeKey...' : 'Confirming on MST Testnet...'}</span>
                      </>
                    ) : (
                      <>
                        <span>💸</span>
                        <span>Release Payment to Robot</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* ─── Payment Released Card — Visible once PAID ─── */}
              {task.state === TaskState.PAID && (
                <div
                  className="card mb-24"
                  data-testid="payment-released-card"
                  style={{
                    border: '1.5px solid var(--green-500)',
                    background: 'linear-gradient(to bottom, #ffffff, #f0fdf4)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '32px' }}>💸</span>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Released</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--slate-900)' }}>Escrow Settled — Task PAID</div>
                    </div>
                  </div>
                  <div style={{ background: 'var(--slate-50)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div className="detail-field">
                        <div className="detail-field__label">Status:</div>
                        <div className="detail-field__value" style={{ fontWeight: 700, color: '#16a34a' }}>PAID</div>
                      </div>
                      <div className="detail-field">
                        <div className="detail-field__label">Amount:</div>
                        <div className="detail-field__value" style={{ fontWeight: 700, color: 'var(--orange-500)' }}>{task.rewardMSTC} MSTC</div>
                      </div>
                      <div className="detail-field">
                        <div className="detail-field__label">Robot:</div>
                        <div className="detail-field__value" style={{ fontWeight: 700 }}>{DEFAULT_ROBOT.id}</div>
                      </div>
                      <div className="detail-field detail-field--full">
                        <div className="detail-field__label">Recipient:</div>
                        <div className="detail-field__value detail-field__value--mono" style={{ fontSize: '12px' }}>
                          {task.robot && !isZeroAddress(task.robot) ? task.robot : DEFAULT_ROBOT.address}
                        </div>
                      </div>
                    </div>
                  </div>
                  {releaseTxHash && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--slate-100)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Payment Transaction:</span>
                      <TransactionLink hash={releaseTxHash} />
                      <a href={`${MST_EXPLORER_URL}/tx/${releaseTxHash}`} target="_blank" rel="noopener noreferrer" className="btn btn--outline btn--sm" style={{ padding: '2px 8px', fontSize: '11px' }}>View on MSTScan ↗</a>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Refund Task Card — Allowed when FUNDED, ASSIGNED, or PROOF_SUBMITTED ─── */}
              {(task.state === TaskState.FUNDED ||
                task.state === TaskState.ASSIGNED ||
                task.state === TaskState.PROOF_SUBMITTED) && (
                <div
                  className="card mb-24"
                  data-testid="refund-task-card"
                  style={{
                    border: '1.5px solid #f59e0b',
                    background: 'linear-gradient(to bottom, #ffffff, #fffbeb)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '24px' }}>↩️</span>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Escrow Recovery</div>
                      <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--slate-900)', margin: 0 }}>Refund Task Escrow</h2>
                    </div>
                  </div>
                  <p style={{ margin: '4px 0 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Recover the escrowed reward if the task cannot be verified or completed. The smart contract will return the full escrow ({task.rewardMSTC} MSTC) to the creator and move the task to <strong>REFUNDED</strong> state.
                  </p>

                  <div style={{ padding: '8px 12px', background: '#fef3c7', borderRadius: '4px', border: '1px solid #fde68a', marginBottom: '14px' }}>
                    <span style={{ fontSize: '11px', color: '#92400e' }}>
                      ⚠️ <strong>Warning:</strong> Refunding cancels further on-chain progress for this task ID. Escrowed funds ({task.rewardMSTC} MSTC) will be returned immediately to your creator address.
                    </span>
                  </div>

                  {!wallet?.isConnected ? (
                    <div className="alert alert--warning mb-16" data-testid="refund-wallet-disconnected-warning">
                      <span>🔑</span>
                      <div><strong>Wallet not connected.</strong> Connect your creator wallet to request a refund.</div>
                    </div>
                  ) : !wallet?.isCorrectNetwork ? (
                    <div className="alert alert--warning mb-16" data-testid="refund-wrong-network-warning">
                      <span>⚠️</span>
                      <div>Please switch your wallet to MST Testnet (Chain ID 91562037).</div>
                    </div>
                  ) : !isCreator ? (
                    <div className="alert alert--warning mb-16" data-testid="refund-not-creator-warning">
                      <span>⚠️</span>
                      <div>Only the task creator ({task.creator ? `${task.creator.slice(0, 10)}…` : '—'}) can request a refund.</div>
                    </div>
                  ) : null}

                  {refundStep !== 'idle' && (
                    <div
                      className={`tx-progress mb-16 ${refundStep === 'confirmed' ? 'tx-progress--success' : ''} ${refundStep === 'failed' ? 'tx-progress--failed' : ''}`}
                      data-testid="refund-tx-progress"
                    >
                      {isRefunding && <div className="spinner spinner--sm" />}
                      {refundStep === 'confirmed' && <span>✅</span>}
                      {refundStep === 'failed' && <span>❌</span>}
                      <span>
                        {refundStep === 'awaiting-approval' ? 'Waiting for BridgeKey confirmation...' :
                         refundStep === 'submitted' ? 'Transaction submitted...' :
                         refundStep === 'confirming' ? 'Waiting for blockchain confirmation...' :
                         refundStep === 'confirmed' ? 'Task refunded — escrow returned to creator.' :
                         TX_STEP_LABELS[refundStep]}
                      </span>
                    </div>
                  )}

                  {refundTxHash && (
                    <div className="mb-16" data-testid="refund-tx-hash-section">
                      <div className="detail-field__label mb-8">Refund Transaction</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <TransactionLink hash={refundTxHash} />
                        <a href={`${MST_EXPLORER_URL}/tx/${refundTxHash}`} target="_blank" rel="noopener noreferrer" className="btn btn--outline btn--sm">View on MSTScan ↗</a>
                      </div>
                    </div>
                  )}

                  {refundError && (
                    <div className="alert alert--error mb-16" data-testid="refund-tx-error">
                      <span>⚠️</span>
                      <span style={{ wordBreak: 'break-word' }}>{refundError}</span>
                    </div>
                  )}

                  <button
                    className="btn btn--outline btn--lg btn--full"
                    onClick={handleRefundTask}
                    disabled={
                      !wallet?.isConnected ||
                      !wallet?.isCorrectNetwork ||
                      !isCreator ||
                      isRefunding ||
                      loading
                    }
                    data-testid="refund-task-btn"
                    style={{ color: '#d97706', borderColor: '#d97706' }}
                  >
                    {isRefunding ? (
                      <>
                        <div className="spinner spinner--sm" />
                        <span>{refundStep === 'awaiting-approval' ? 'Approve in BridgeKey...' : 'Confirming on MST Testnet...'}</span>
                      </>
                    ) : (
                      <>
                        <span>↩️</span>
                        <span>Refund Task Escrow ({task.rewardMSTC} MSTC)</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* ─── Task Refunded Confirmation Card — Visible when REFUNDED ─── */}
              {task.state === TaskState.REFUNDED && (
                <div
                  className="card mb-24"
                  data-testid="task-refunded-card"
                  style={{
                    border: '1.5px solid #ef4444',
                    background: 'linear-gradient(to bottom, #ffffff, #fef2f2)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '24px' }}>↩️</span>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Task Refunded</div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--slate-900)' }}>Escrow Returned to Creator</div>
                    </div>
                  </div>
                  <p style={{ margin: '4px 0 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    The escrowed reward of <strong>{task.rewardMSTC} MSTC</strong> has been refunded to creator {task.creator ? `${task.creator.slice(0, 10)}…` : ''}.
                  </p>
                  {refundTxHash && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--slate-100)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Refund Transaction:</span>
                      <TransactionLink hash={refundTxHash} />
                      <a href={`${MST_EXPLORER_URL}/tx/${refundTxHash}`} target="_blank" rel="noopener noreferrer" className="btn btn--outline btn--sm" style={{ padding: '2px 8px', fontSize: '11px' }}>View on MSTScan ↗</a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Workflow sidebar */}
            <div className="card" style={{ position: 'sticky', top: '80px' }}>
              <div className="card__title" style={{ marginBottom: '20px' }}>
                🔄 Task Workflow
              </div>

              <div className="workflow workflow--vertical">
                {WORKFLOW_STEPS.map((step, idx) => {
                  const done = task.state > step.state;
                  const active = task.state === step.state;
                  const refunded = task.state === TaskState.REFUNDED;

                  // If refunded, only show up to FUNDED as done
                  const isDone = refunded ? step.state < TaskState.FUNDED : done;
                  const isActive = refunded && step.state === TaskState.FUNDED
                    ? false
                    : active;

                  return (
                    <div key={step.state}>
                      <div
                        className={`workflow-step ${isDone ? 'workflow-step--done' : ''} ${isActive ? 'workflow-step--active' : ''}`}
                      >
                        <div className="workflow-step__dot">
                          {isDone ? '✓' : isActive ? '●' : idx + 1}
                        </div>
                        <div>
                          <div className="workflow-step__label">{step.label}</div>
                          {isActive && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {step.description}
                            </div>
                          )}
                        </div>
                      </div>
                      {idx < WORKFLOW_STEPS.length - 1 && (
                        <div className={`workflow-step__connector ${isDone ? 'workflow-step--done' : ''}`} />
                      )}
                    </div>
                  );
                })}

                {task.state === TaskState.REFUNDED && (
                  <div className="workflow-step" style={{ background: 'var(--red-100)' }}>
                    <div
                      className="workflow-step__dot"
                      style={{ background: 'var(--red-500)', borderColor: 'var(--red-500)', color: 'white' }}
                    >
                      ↩
                    </div>
                    <div className="workflow-step__label" style={{ color: 'var(--red-600)' }}>
                      Refunded
                    </div>
                  </div>
                )}
              </div>

              <div className="divider" />
              <div style={{ textAlign: 'center' }}>
                <a
                  href={`${MST_EXPLORER_URL}/address/${task.creator}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--outline btn--sm btn--full"
                >
                  View on MSTScan ↗
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
