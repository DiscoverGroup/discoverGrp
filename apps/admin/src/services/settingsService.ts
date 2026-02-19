import { getAdminApiBaseUrl } from '../config/apiBase';
import { authFetch } from '../utils/tokenStorage';

const API_BASE_URL = getAdminApiBaseUrl();

export interface EmailSettings {
  bookingDepartmentEmail: string;
  emailFromAddress: string;
  emailFromName: string;
}

export async function getEmailSettings(): Promise<EmailSettings> {
  const res = await authFetch(`${API_BASE_URL}/admin/settings`);
  
  if (!res.ok) throw new Error('Failed to fetch email settings');
  
  const data = await res.json();
  return data.settings;
}

export async function updateEmailSettings(settings: Partial<EmailSettings>): Promise<EmailSettings> {
  const res = await authFetch(`${API_BASE_URL}/admin/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });
  
  if (!res.ok) throw new Error('Failed to update email settings');
  
  const data = await res.json();
  return data.settings;
}
