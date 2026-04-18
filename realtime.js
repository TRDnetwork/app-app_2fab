let channels = [];

export function setupRealtime(supabase, onChange) {
  // Subscribe to todos table for current user
  const channel = supabase
    .channel('todos-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_2fab_todos',
        filter: `user_id=eq.${(supabase.auth.getUser()?.data?.user?.id) || 'unknown'}`
      },
      (payload) => {
        console.log('Realtime update:', payload);
        onChange(payload);
      }
    )
    .subscribe();

  channels.push(channel);
}

export function teardownRealtime() {
  channels.forEach(channel => {
    channel.unsubscribe();
  });
  channels = [];
}