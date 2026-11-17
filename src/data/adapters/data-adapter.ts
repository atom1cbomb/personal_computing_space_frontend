import type {
  ActionInvocationRequest,
  ActionInvocationResult,
  Activation,
  ActivationManagementRequest,
  CapabilityPackage,
  Resource,
  Run,
} from "../../domain/models";

export interface DataAdapter {
  listResources(): Promise<Resource[]>;
  getResource(id: string): Promise<Resource | undefined>;
  listPackages(): Promise<CapabilityPackage[]>;
  getPackage(id: string): Promise<CapabilityPackage | undefined>;
  listActivations(): Promise<Activation[]>;
  listRuns(): Promise<Run[]>;
  invokeAction(request: ActionInvocationRequest): Promise<ActionInvocationResult>;
  manageActivation(request: ActivationManagementRequest): Promise<Activation>;
}
