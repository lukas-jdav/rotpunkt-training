/* Manuelle Tivoli-Routenaktualisierung (Stand 19.06.2026)
 * Quelle: 8a.nu / Vertical-Life, Snapshot 2026-06-19.
 * Die beiden Positionen 28.1 und 28.2 ersetzen die älteren Einträge.
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
