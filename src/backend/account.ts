import type { AuthUser } from '../auth';
import type { AccountEntitlement, AccountEntitlements } from './types';

export type AccountState =
  | { status: 'loading'; user: AuthUser | null }
  | { status: 'signed-out'; user: null }
  | { status: 'free'; user: AuthUser; entitlement?: AccountEntitlement }
  | { status: 'plus'; user: AuthUser; entitlement: AccountEntitlement }
  | { status: 'backend-error'; user: AuthUser; message: string };

export interface AccountAuthSource {
  subscribe(listener: (user: AuthUser | null) => void): () => void;
}

export interface EntitlementsClient {
  readonly configured: boolean;
  getEntitlements(): Promise<AccountEntitlements>;
}

export class AccountSession {
  private state: AccountState = { status: 'loading', user: null };
  private readonly listeners = new Set<() => void>();
  private revision = 0;
  private readonly unsubscribeAuth: () => void;

  constructor(
    private readonly authSource: AccountAuthSource,
    private readonly client: EntitlementsClient,
  ) {
    this.unsubscribeAuth = authSource.subscribe((user) => {
      const revision = ++this.revision;
      if (!user) {
        this.setState({ status: 'signed-out', user: null });
        return;
      }
      this.setState({ status: 'loading', user });
      void this.load(user, revision);
    });
  }

  getSnapshot = (): AccountState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async refresh(): Promise<void> {
    if (!this.state.user) return;
    const user = this.state.user;
    const revision = ++this.revision;
    this.setState({ status: 'loading', user });
    await this.load(user, revision);
  }

  dispose(): void {
    this.unsubscribeAuth();
    this.listeners.clear();
  }

  private async load(user: AuthUser, revision: number): Promise<void> {
    if (!this.client.configured) {
      if (revision === this.revision)
        this.setState({
          status: 'backend-error',
          user,
          message: 'RentSight cloud services are not configured in this build.',
        });
      return;
    }
    try {
      const response = await this.client.getEntitlements();
      if (revision !== this.revision) return;
      const plus = response.entitlements.find((item) => item.key === 'plus');
      this.setState(
        plus?.active
          ? { status: 'plus', user, entitlement: plus }
          : { status: 'free', user, entitlement: plus },
      );
    } catch (error: unknown) {
      if (revision !== this.revision) return;
      this.setState({
        status: 'backend-error',
        user,
        message:
          error instanceof Error
            ? error.message
            : 'Could not check your RentSight plan.',
      });
    }
  }

  private setState(state: AccountState): void {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
}
