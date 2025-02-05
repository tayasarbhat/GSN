const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw92_T-sJIj00VgAeou8pNPBm5Tt-P_KY1lIZoY10U8xKDl8TV_ePqZ1I9Xcf4EazKt/exec';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options?: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      await wait(RETRY_DELAY);
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

export async function fetchSheetData() {
  try {
    const response = await fetchWithRetry(GOOGLE_SCRIPT_URL);
    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid data format received from API');
    }
    
    return data;
  } catch (error) {
    console.error('Failed to fetch sheet data:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch data');
  }
}

export async function updateStatus(rowIndex: number, newStatus: 'Open' | 'Reserved') {
  try {
    const response = await fetchWithRetry(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ rowIndex, newStatus }),
    });
    
    const result = await response.json();
    
    if (!result || result.error) {
      throw new Error(result?.error || 'Failed to update status');
    }
    
    return result;
  } catch (error) {
    console.error('Failed to update status:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to update status');
  }
}