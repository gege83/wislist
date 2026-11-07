export async function refreshInviteLists(
  loadPendingInvites: () => Promise<void>,
  loadSentInvites: () => Promise<void>
): Promise<void> {
  await Promise.all([loadPendingInvites(), loadSentInvites()]);
}

export async function acceptInviteAndRefresh<T>(
  accept: () => Promise<T>,
  refresh: () => Promise<void>
): Promise<T> {
  const result = await accept();
  await refresh();
  return result;
}
