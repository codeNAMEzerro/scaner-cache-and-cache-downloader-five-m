/**
 * Wrapper for FiveM NUI fetch callbacks
 */
export async function fetchNui(eventName, data = {}, mockResp = null) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(data),
  };

  const resourceName = window.GetParentResourceName ? window.GetParentResourceName() : 'nr_cachedownload';

  try {
    const resp = await fetch(`https://${resourceName}/${eventName}`, options);
    return await resp.json();
  } catch (err) {
    if (mockResp !== null) return mockResp;
    return null;
  }
}
