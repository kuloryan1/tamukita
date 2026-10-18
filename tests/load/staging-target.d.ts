export interface StagingInvitationTarget {
  origin: string;
  invitationUrl: URL;
}

export interface VerifyPublishedStagingInvitationOptions {
  baseUrl?: string;
  invitationPath?: string;
  productionHostnames?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createStagingInvitationTarget(input: {
  baseUrl?: string;
  invitationPath?: string;
  productionHostnames?: string;
}): StagingInvitationTarget;

export function verifyPublishedStagingInvitation(input: VerifyPublishedStagingInvitationOptions): Promise<URL>;
