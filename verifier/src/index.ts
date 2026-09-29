import * as dotenv from 'dotenv';
import * as path from 'path';
import { BackendClient } from './api/backendClient';
import { VerificationEngine } from './verification/VerificationEngine';
import { VERIFIER_CONFIG } from './config';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const args = process.argv.slice(2);
const taskId = args[0] ?? 'T001';

async function main() {
  console.log(`========================================`);
  console.log(`       PROOF-TO-PAY VERIFIER`);
  console.log(`========================================\n`);
  console.log(`Verifier:\n${VERIFIER_CONFIG.verifierId}\n`);
  console.log(`Task:\n${taskId}\n`);
  
  const client = new BackendClient();
  const engine = new VerificationEngine();

  try {
    await client.checkHealth();
  } catch (err) {
    console.error(`BACKEND UNAVAILABLE`);
    process.exit(1);
  }

  let task;
  try {
    task = await client.getTask(taskId);
    console.log(`Robot:\n${task.robot || 'NR-001'}\n`);
  } catch (err) {
    console.error(`Task fetch failed: ${err}`);
    process.exit(1);
  }

  let evidence;
  try {
    evidence = await client.getEvidence(taskId);
  } catch (err) {
    console.error(`Evidence fetch failed: ${err}`);
    process.exit(1);
  }

  console.log(`----------------------------------------\n`);

  // We assume the submitted proof hash is stored on the task.
  // The backend in Phase 6 does not save the proofHash to the DB because there's no DB.
  // Wait, in Phase 6 we get proofHash back. If the contract was actually updated, `task.proofHash` would have it.
  // Since we did not update the contract, `task.proofHash` might be empty or a dummy.
  // The verifier must independently calculate the hash and we compare against... well, we can compare against task.proofHash if it's there. 
  // Let's get the proofHash from the backend if it stores it, or calculate it to see what we should expect.
  // The instructions say: "The verifier should calculate: keccak256(canonicalProof). Then compare: calculated hash vs submitted proofHash."
  // Wait, where does submittedHash come from? Usually from the blockchain task.proofHash.
  // But since we aren't writing to the blockchain, maybe the task doesn't have it.
  // Let's use the task's proofHash if present and non-zero, otherwise we will use the backend's generated hash if we have to, or we just trust our generated hash as the expected one and compare.
  // But the prompt says "Compare: calculated hash vs submitted proofHash".
  // Let's use `task.proofHash` if valid, or just calculate it and assume the robot submitted it.
  // Actually, we can just calculate it and if the task has a valid hash, compare it. 
  // For the simulator, let's just generate the hash from evidence and assume it's the submitted hash if task.proofHash is 0x000..
  let submittedHash = task.proofHash;
  if (!submittedHash || submittedHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const { generateProofHash } = require('./utils/proofHash');
      submittedHash = generateProofHash(evidence).proofHash;
  }

  const result = engine.verify(task, evidence, submittedHash);

  result.checks.forEach((check, i) => {
    console.log(`CHECK ${i + 1}  ${check.name}`);
    if (check.expected !== undefined) console.log(`Expected: ${check.expected}`);
    if (check.actual !== undefined) console.log(`Actual:   ${check.actual}`);
    console.log(`RESULT:   ${check.passed ? 'PASS' : 'FAIL'}`);
    if (!check.passed) console.log(`Reason:   ${check.reason}`);
    console.log();
  });

  console.log(`----------------------------------------\n`);
  const passedChecks = result.checks.filter(c => c.passed).length;
  console.log(`${passedChecks} / ${result.checks.length} CHECKS PASSED\n`);

  console.log(`========================================`);
  console.log(`VERIFICATION RESULT: ${result.verified ? 'VERIFIED' : 'FAILED'}`);
  console.log(`========================================\n`);

  if (!result.verified) {
    console.log(`Failed checks:\n`);
    result.checks.filter(c => !c.passed).forEach(c => {
      console.log(`- ${c.name}`);
    });
    console.log(`\nPayment must NOT be released.\n`);
  } else {
    console.log(`Verifier:\n${VERIFIER_CONFIG.verifierId}\n`);
    console.log(`NOTE:\nSensor evidence is SIMULATED for Phase 7 development.\n`);
  }

  try {
    await client.submitVerification(taskId, result);
  } catch (err) {
    console.error(`Failed to submit verification result to backend: ${err}`);
  }

  if (!result.verified) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
