/* Manuelle Tivoli-Routenaktualisierung (Stand 19.06.2026).
 * Die Routepositionen 28.1 und 28.2 wurden gegenüber dem bisherigen Stand ersetzt.
 * Dieser Block wird vor routes.js geladen und hält die statischen Routendaten aktuell,
 * bis der automatische Sync wieder erfolgreich aktualisiert.
 */
(() => {
  const lines = String(window.TIVOLI_ROUTE_CSV || '').split('\n');
  const header = lines.shift();
  const filtered = lines.filter((line) => {
    const location = line.split(',')[0];
    return location !== '28.1' && location !== '28.2';
  });

  filtered.push(
    '28.1,8+,#32cd32,,irgendwas mit Mimmimi,,2026-06-17 12:00:00 UTC,https://www.8a.nu/gyms/badminton-kletterhalle-tivoli/topos/sportclimbing#route-366626,https://www.8a.nu/gyms/badminton-kletterhalle-tivoli/zlaggables/sportclimbing/366626/ascents,,Silas Pollmann,Sportklettern Erdgeschoß,Main Wall',
    '28.2,7,#808080,,Am Ende gut,,2026-06-18 14:49:25 UTC,https://www.8a.nu/gyms/badminton-kletterhalle-tivoli/topos/sportclimbing#route-366627,https://www.8a.nu/gyms/badminton-kletterhalle-tivoli/zlaggables/sportclimbing/366627/ascents,,Julius Dammann,Sportklettern Erdgeschoß,Main Wall'
  );

  window.TIVOLI_ROUTE_CSV = [header, ...filtered].join('\n');
})();

window.TIVOLI_ROUTE_SYNC = {
  "generatedAt": "2026-09-07T00:00:00.000Z",
  "sourceUrl": "https://www.8a.nu/gyms/badminton-kletterhalle-tivoli/topos/sportclimbing",
  "totalRoutes": 146,
  "hasChanges": true,
  "changeId": "manual-2026-06-19",
  "summary": {
    "added": 2,
    "updated": 0,
    "removed": 2
  },
  "changes": {
    "added": [
      {"routeCode": "28.1", "name": "irgendwas mit Mimmimi", "set_at": "2026-06-17 12:00:00 UTC"},
      {"routeCode": "28.2", "name": "Am Ende gut", "set_at": "2026-06-18 14:49:25 UTC"}
    ],
    "updated": [],
    "removed": []
  }
};
