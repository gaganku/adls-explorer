/**
 * Lightweight in-memory SQL SELECT engine — no dependencies.
 * Table name is always "data".
 *
 * Supported syntax:
 *   SELECT * FROM data
 *   SELECT col1, col2 FROM data
 *   SELECT * FROM data WHERE col = 'value'
 *   SELECT * FROM data WHERE col > 100 AND col2 LIKE '%foo%'
 *   SELECT * FROM data ORDER BY col DESC
 *   SELECT * FROM data LIMIT 100
 *   SELECT COUNT(*), SUM(col), AVG(col), MIN(col), MAX(col) FROM data
 *   — all clauses can be combined in the above order
 */

export function executeSQL(sql, data) {
  const q = sql.trim().replace(/\s+/g, " ");

  // Parse clauses with regex
  const m = q.match(
    /^SELECT\s+(.*?)\s+FROM\s+data(?:\s+WHERE\s+(.*?))?(?:\s+ORDER\s+BY\s+(.*?)(?:\s+(ASC|DESC))?)?(?:\s+LIMIT\s+(\d+))?$/i
  );
  if (!m) {
    throw new Error(
      "Invalid SQL. Supported: SELECT … FROM data [WHERE …] [ORDER BY col [ASC|DESC]] [LIMIT n]"
    );
  }

  const [, colsPart, wherePart, orderCol, orderDir, limitStr] = m;

  // 1 — WHERE filter
  let result = wherePart ? data.filter((row) => evalCondition(row, wherePart)) : [...data];

  // 2 — ORDER BY
  if (orderCol) {
    const dir = orderDir?.toUpperCase() === "DESC" ? -1 : 1;
    result = [...result].sort((a, b) => {
      const av = a[orderCol.trim()];
      const bv = b[orderCol.trim()];
      if (av == null && bv == null) return 0;
      if (av == null) return dir;
      if (bv == null) return -dir;
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }

  // 3 — LIMIT
  if (limitStr) result = result.slice(0, parseInt(limitStr, 10));

  // 4 — SELECT projection
  const cols = colsPart.trim();
  if (cols === "*") return result;

  // Aggregate functions?
  if (/\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(cols)) {
    return applyAggregates(result, cols);
  }

  // Column list projection
  const colList = cols.split(",").map((c) => c.trim());
  return result.map((row) => {
    const out = {};
    colList.forEach((c) => (out[c] = row[c]));
    return out;
  });
}

// ─── WHERE evaluator ──────────────────────────────────────────────────────────

function evalCondition(row, expr) {
  expr = expr.trim();

  // AND (split right-to-left to handle operator precedence roughly)
  const andIdx = findLogicalOp(expr, "AND");
  if (andIdx !== -1) {
    return (
      evalCondition(row, expr.slice(0, andIdx)) &&
      evalCondition(row, expr.slice(andIdx + 3))
    );
  }

  // OR
  const orIdx = findLogicalOp(expr, "OR");
  if (orIdx !== -1) {
    return (
      evalCondition(row, expr.slice(0, orIdx)) ||
      evalCondition(row, expr.slice(orIdx + 2))
    );
  }

  // LIKE
  const likeM = expr.match(/^(\w+)\s+LIKE\s+(.+)$/i);
  if (likeM) {
    const [, col, patRaw] = likeM;
    const pattern = parseValue(patRaw.trim());
    const regex = new RegExp(
      "^" + String(pattern).replace(/%/g, ".*").replace(/_/g, ".") + "$",
      "i"
    );
    return regex.test(String(row[col] ?? ""));
  }

  // NOT LIKE
  const notLikeM = expr.match(/^(\w+)\s+NOT\s+LIKE\s+(.+)$/i);
  if (notLikeM) {
    const [, col, patRaw] = notLikeM;
    const pattern = parseValue(patRaw.trim());
    const regex = new RegExp(
      "^" + String(pattern).replace(/%/g, ".*").replace(/_/g, ".") + "$",
      "i"
    );
    return !regex.test(String(row[col] ?? ""));
  }

  // IS NULL / IS NOT NULL
  const nullM = expr.match(/^(\w+)\s+IS\s+(NOT\s+)?NULL$/i);
  if (nullM) {
    const [, col, notPart] = nullM;
    const isNull = row[col] == null || row[col] === "";
    return notPart ? !isNull : isNull;
  }

  // Comparison: col OP value
  const cmpM = expr.match(/^(\w+)\s*(>=|<=|!=|<>|=|>|<)\s*(.+)$/);
  if (cmpM) {
    const [, col, op, valRaw] = cmpM;
    const rowVal = row[col];
    const val = parseValue(valRaw.trim());
    switch (op) {
      case "=":  return String(rowVal) === String(val) || rowVal == val;
      case "!=":
      case "<>": return rowVal != val;
      case ">":  return Number(rowVal) > Number(val);
      case "<":  return Number(rowVal) < Number(val);
      case ">=": return Number(rowVal) >= Number(val);
      case "<=": return Number(rowVal) <= Number(val);
    }
  }

  return true; // unknown expr — pass through
}

/** Find AND/OR keyword not inside quotes */
function findLogicalOp(expr, op) {
  const re = new RegExp(`\\b${op}\\b`, "i");
  let depth = 0;
  let inQ = false;
  let qChar = "";
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (inQ) { if (ch === qChar) inQ = false; continue; }
    if (ch === "'" || ch === '"') { inQ = true; qChar = ch; continue; }
    if (ch === "(") { depth++; continue; }
    if (ch === ")") { depth--; continue; }
    if (depth === 0) {
      const sub = expr.slice(i);
      if (re.test(sub) && sub.toUpperCase().startsWith(op.toUpperCase())) {
        // Make sure it's a word boundary before
        if (i > 0 && /\w/.test(expr[i - 1])) continue;
        return i;
      }
    }
  }
  return -1;
}

function parseValue(s) {
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"')))
    return s.slice(1, -1);
  if (s.toLowerCase() === "null") return null;
  if (s.toLowerCase() === "true") return true;
  if (s.toLowerCase() === "false") return false;
  if (!isNaN(s) && s !== "") return Number(s);
  return s;
}

// ─── Aggregate functions ──────────────────────────────────────────────────────

function applyAggregates(data, colsPart) {
  const result = {};
  const items = colsPart.split(",").map((c) => c.trim());

  items.forEach((item) => {
    // COUNT(*)
    if (/^COUNT\(\*\)$/i.test(item)) { result["COUNT(*)"] = data.length; return; }

    // FUNC(col) AS alias  or  FUNC(col)
    const fm = item.match(/^(COUNT|SUM|AVG|MIN|MAX)\((\w+)\)(?:\s+AS\s+(\w+))?$/i);
    if (fm) {
      const [, fn, col, alias] = fm;
      const key = alias ?? `${fn.toUpperCase()}(${col})`;
      const vals = data.map((r) => r[col]).filter((v) => v != null);
      const nums = vals.map(Number).filter((v) => !isNaN(v));
      switch (fn.toUpperCase()) {
        case "COUNT": result[key] = vals.length; break;
        case "SUM":   result[key] = nums.reduce((a, b) => a + b, 0); break;
        case "AVG":   result[key] = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null; break;
        case "MIN":   result[key] = nums.length ? Math.min(...nums) : null; break;
        case "MAX":   result[key] = nums.length ? Math.max(...nums) : null; break;
      }
      return;
    }

    // Plain column in aggregate query — take first row value
    result[item] = data[0]?.[item];
  });

  return [result];
}
