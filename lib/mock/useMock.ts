// Mock-modus helper — aktiver med NEXT_PUBLIC_MOCK_MODE=true i .env.local
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_MOCK_MODE === 'true'
}

export const MOCK_USER_ID = 'mock-user-001'
