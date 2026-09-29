import { VERIFIER_CONFIG } from "../config";
import { VerificationResult, ProofEvidence } from "../types/verification";

export class BackendClient {
  private baseUrl = VERIFIER_CONFIG.backendUrl;

  async checkHealth(): Promise<{ status: string }> {
    const res = await fetch(`${this.baseUrl}/api/health`);
    if (!res.ok) throw new Error("Backend health check failed");
    return res.json() as Promise<{ status: string }>;
  }

  async getTask(taskId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}`);
    if (!res.ok) throw new Error(`Task ${taskId} not found`);
    const data = (await res.json()) as any;
    return data.data;
  }

  async getEvidence(taskId: string): Promise<ProofEvidence> {
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}/evidence`);
    if (!res.ok) throw new Error(`Evidence for task ${taskId} not found`);
    const data = (await res.json()) as any;
    return data.data as ProofEvidence;
  }

  async submitVerification(taskId: string, result: VerificationResult): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/tasks/${taskId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    if (!res.ok) throw new Error("Failed to submit verification");
    return res.json();
  }
}
