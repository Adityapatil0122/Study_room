export function buildUpdateClause(payload) {
  const entries = Object.entries(payload).filter(([, value]) => value !== undefined);

  return {
    clause: entries.map(([column]) => `${column} = ?`).join(", "),
    values: entries.map(([, value]) => value),
  };
}
