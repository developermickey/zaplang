/**
 * Zap → C99 code generator
 * Supports: numbers, strings, booleans, arrays, objects (as structs), functions
 */
import { Node, Route } from "./parser"

// ── C Runtime ────────────────────────────────────────────────────────
const C_RUNTIME = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <math.h>
#include <time.h>
#include <stdint.h>

/* ──────────────────────────────────────────────
   ZapString
─────────────────────────────────────────────── */
typedef struct { char *data; size_t len; } ZapString;

static ZapString zap_str(const char *s) {
  size_t n = s ? strlen(s) : 0;
  ZapString z; z.data = (char*)malloc(n + 1);
  if (s) memcpy(z.data, s, n); z.data[n] = '\\0'; z.len = n;
  return z;
}
static ZapString zap_str_concat(ZapString a, ZapString b) {
  size_t n = a.len + b.len;
  ZapString z; z.data = (char*)malloc(n + 1);
  memcpy(z.data, a.data, a.len); memcpy(z.data + a.len, b.data, b.len);
  z.data[n] = '\\0'; z.len = n; return z;
}
static ZapString zap_num_to_str(double n) {
  char buf[64];
  if (n == (long long)n) snprintf(buf, sizeof(buf), "%lld", (long long)n);
  else snprintf(buf, sizeof(buf), "%g", n);
  return zap_str(buf);
}
static ZapString zap_bool_to_str(int b) { return zap_str(b ? "true" : "false"); }
static double    zap_str_to_num(ZapString s) { return atof(s.data); }
static int       zap_str_eq(ZapString a, ZapString b) { return strcmp(a.data, b.data) == 0; }

/* ──────────────────────────────────────────────
   ZapValue — tagged union (number | string | bool | array | null)
─────────────────────────────────────────────── */
typedef enum { ZAP_NULL=0, ZAP_NUM, ZAP_STR, ZAP_BOOL, ZAP_ARR, ZAP_OBJ } ZapTag;
typedef struct ZapValue ZapValue;
typedef struct {
  ZapValue *data;
  size_t    len;
  size_t    cap;
} ZapArray;
typedef struct {
  char    **keys;
  ZapValue *vals;
  size_t    len;
  size_t    cap;
} ZapObject;

struct ZapValue {
  ZapTag tag;
  union {
    double     num;
    ZapString  str;
    int        boolean;
    ZapArray  *arr;
    ZapObject *obj;
  };
};

static ZapValue zap_val_num(double n)    { ZapValue v; v.tag=ZAP_NUM;  v.num=n;     return v; }
static ZapValue zap_val_str(ZapString s) { ZapValue v; v.tag=ZAP_STR;  v.str=s;     return v; }
static ZapValue zap_val_bool(int b)      { ZapValue v; v.tag=ZAP_BOOL; v.boolean=b; return v; }
static ZapValue zap_val_null(void)       { ZapValue v; v.tag=ZAP_NULL; v.num=0;     return v; }
static ZapValue zap_val_obj(ZapObject *o){ ZapValue v; v.tag=ZAP_OBJ;  v.obj=o;     return v; }

/* ──────────────────────────────────────────────
   ZapObject operations
─────────────────────────────────────────────── */
static ZapArray *zap_arr_new(void);
static void zap_arr_push(ZapArray *a, ZapValue v);

static ZapObject *zap_obj_new(void) {
  ZapObject *o = (ZapObject*)malloc(sizeof(ZapObject));
  o->cap = 8; o->len = 0;
  o->keys = (char**)malloc(o->cap * sizeof(char*));
  o->vals = (ZapValue*)malloc(o->cap * sizeof(ZapValue));
  return o;
}
static void zap_obj_set(ZapObject *o, const char *key, ZapValue val) {
  for (size_t i = 0; i < o->len; i++) {
    if (strcmp(o->keys[i], key) == 0) { o->vals[i] = val; return; }
  }
  if (o->len == o->cap) {
    o->cap *= 2;
    o->keys = (char**)realloc(o->keys, o->cap * sizeof(char*));
    o->vals = (ZapValue*)realloc(o->vals, o->cap * sizeof(ZapValue));
  }
  o->keys[o->len] = (char*)malloc(strlen(key)+1);
  strcpy(o->keys[o->len], key);
  o->vals[o->len] = val;
  o->len++;
}
static ZapValue zap_obj_get(ZapObject *o, const char *key) {
  for (size_t i = 0; i < o->len; i++)
    if (strcmp(o->keys[i], key) == 0) return o->vals[i];
  return zap_val_null();
}
static ZapArray *zap_obj_keys(ZapObject *o) {
  ZapArray *a = zap_arr_new();
  for (size_t i = 0; i < o->len; i++) {
    ZapValue v; v.tag = ZAP_STR; v.str = zap_str(o->keys[i]);
    zap_arr_push(a, v);
  }
  return a;
}
static ZapArray *zap_obj_values(ZapObject *o) {
  ZapArray *a = zap_arr_new();
  for (size_t i = 0; i < o->len; i++) zap_arr_push(a, o->vals[i]);
  return a;
}

/* ──────────────────────────────────────────────
   ZapArray operations
─────────────────────────────────────────────── */
static ZapArray *zap_arr_new(void) {
  ZapArray *a = (ZapArray*)malloc(sizeof(ZapArray));
  a->cap = 8; a->len = 0;
  a->data = (ZapValue*)malloc(a->cap * sizeof(ZapValue));
  return a;
}
static void zap_arr_push(ZapArray *a, ZapValue v) {
  if (a->len == a->cap) {
    a->cap *= 2;
    a->data = (ZapValue*)realloc(a->data, a->cap * sizeof(ZapValue));
  }
  a->data[a->len++] = v;
}
static ZapValue zap_arr_get(ZapArray *a, double idx) {
  long long i = (long long)idx;
  if (i < 0) i += (long long)a->len;
  if (i < 0 || (size_t)i >= a->len) return zap_val_null();
  return a->data[i];
}
static void zap_arr_set(ZapArray *a, double idx, ZapValue v) {
  long long i = (long long)idx;
  if (i >= 0 && (size_t)i < a->len) a->data[i] = v;
}
static ZapValue zap_arr_pop(ZapArray *a) {
  if (a->len == 0) return zap_val_null();
  return a->data[--a->len];
}
static double zap_arr_len(ZapArray *a) { return (double)a->len; }

static ZapArray *zap_arr_slice(ZapArray *a, double s, double e) {
  size_t start = (size_t)(s < 0 ? 0 : s);
  size_t end   = (size_t)(e < 0 ? a->len : (e > a->len ? a->len : e));
  ZapArray *r = zap_arr_new();
  for (size_t i = start; i < end; i++) zap_arr_push(r, a->data[i]);
  return r;
}

static ZapArray *zap_arr_reverse(ZapArray *a) {
  ZapArray *r = zap_arr_new();
  for (size_t i = a->len; i-- > 0;) zap_arr_push(r, a->data[i]);
  return r;
}

static int _cmp_num(const void *x, const void *y) {
  double a = ((ZapValue*)x)->num, b = ((ZapValue*)y)->num;
  return a < b ? -1 : a > b ? 1 : 0;
}
static int _cmp_str(const void *x, const void *y) {
  return strcmp(((ZapValue*)x)->str.data, ((ZapValue*)y)->str.data);
}
static ZapArray *zap_arr_sort(ZapArray *a) {
  ZapArray *r = zap_arr_new();
  for (size_t i = 0; i < a->len; i++) zap_arr_push(r, a->data[i]);
  if (r->len > 0) {
    if (r->data[0].tag == ZAP_STR) qsort(r->data, r->len, sizeof(ZapValue), _cmp_str);
    else qsort(r->data, r->len, sizeof(ZapValue), _cmp_num);
  }
  return r;
}

static int zap_arr_includes(ZapArray *a, ZapValue v) {
  for (size_t i = 0; i < a->len; i++) {
    if (a->data[i].tag == v.tag) {
      if (v.tag == ZAP_NUM  && a->data[i].num == v.num)                return 1;
      if (v.tag == ZAP_STR  && zap_str_eq(a->data[i].str, v.str))     return 1;
      if (v.tag == ZAP_BOOL && a->data[i].boolean == v.boolean)        return 1;
    }
  }
  return 0;
}

static double zap_arr_index_of(ZapArray *a, ZapValue v) {
  for (size_t i = 0; i < a->len; i++) {
    if (a->data[i].tag == v.tag) {
      if (v.tag == ZAP_NUM  && a->data[i].num == v.num)                return (double)i;
      if (v.tag == ZAP_STR  && zap_str_eq(a->data[i].str, v.str))     return (double)i;
      if (v.tag == ZAP_BOOL && a->data[i].boolean == v.boolean)        return (double)i;
    }
  }
  return -1;
}

static ZapString zap_arr_join(ZapArray *a, ZapString sep) {
  ZapString r = zap_str("");
  for (size_t i = 0; i < a->len; i++) {
    ZapString item;
    if      (a->data[i].tag == ZAP_NUM)  item = zap_num_to_str(a->data[i].num);
    else if (a->data[i].tag == ZAP_STR)  item = a->data[i].str;
    else if (a->data[i].tag == ZAP_BOOL) item = zap_bool_to_str(a->data[i].boolean);
    else                                  item = zap_str("null");
    r = zap_str_concat(r, item);
    if (i + 1 < a->len) r = zap_str_concat(r, sep);
  }
  return r;
}

/* ──────────────────────────────────────────────
   Print helpers
─────────────────────────────────────────────── */
static void zap_print_num(double n) {
  if (n == (long long)n) printf("%lld\\n", (long long)n);
  else printf("%g\\n", n);
}
static void zap_print_str(ZapString s)  { printf("%s\\n", s.data); }
static void zap_print_bool(int b)       { printf("%s\\n", b ? "true" : "false"); }
static void zap_print_null(void)        { printf("null\\n"); }
static void zap_print_val(ZapValue v);
static void zap_print_arr(ZapArray *a) {
  printf("[");
  for (size_t i = 0; i < a->len; i++) {
    if (i > 0) printf(", ");
    zap_print_val(a->data[i]);
  }
  printf("]\\n");
}
static void zap_print_obj(ZapObject *o);
static void zap_print_val(ZapValue v) {
  switch(v.tag) {
    case ZAP_NUM:  if(v.num==(long long)v.num) printf("%lld",(long long)v.num); else printf("%g",v.num); break;
    case ZAP_STR:  printf("%s", v.str.data); break;
    case ZAP_BOOL: printf("%s", v.boolean ? "true" : "false"); break;
    case ZAP_ARR:  {
      printf("[");
      for(size_t i=0;i<v.arr->len;i++){if(i>0)printf(", ");zap_print_val(v.arr->data[i]);}
      printf("]");
      break;
    }
    case ZAP_OBJ: zap_print_obj(v.obj); break;
    default: printf("null"); break;
  }
}
static void zap_print_obj(ZapObject *o) {
  printf("{");
  for (size_t i = 0; i < o->len; i++) {
    if (i > 0) printf(", ");
    printf("%s: ", o->keys[i]);
    zap_print_val(o->vals[i]);
  }
  printf("}");
}
static void zap_print_obj_ln(ZapObject *o) { zap_print_obj(o); printf("\\n"); }

/* ──────────────────────────────────────────────
   Math builtins
─────────────────────────────────────────────── */
static double zap_abs(double x)           { return fabs(x); }
static double zap_sqrt(double x)          { return sqrt(x); }
static double zap_floor(double x)         { return floor(x); }
static double zap_ceil(double x)          { return ceil(x); }
static double zap_round(double x)         { return round(x); }
static double zap_pow(double x, double y) { return pow(x, y); }
static double zap_min2(double a, double b){ return a < b ? a : b; }
static double zap_max2(double a, double b){ return a > b ? a : b; }
static double zap_random(void)            { return (double)rand() / RAND_MAX; }
static double zap_random_int(double lo, double hi) {
  return lo + (int)(zap_random() * (hi - lo));
}

/* ──────────────────────────────────────────────
   String builtins
─────────────────────────────────────────────── */
static ZapString zap_upper(ZapString s) {
  ZapString r = zap_str(s.data);
  for (size_t i=0; i<r.len; i++) r.data[i]=(char)toupper((unsigned char)r.data[i]);
  return r;
}
static ZapString zap_lower(ZapString s) {
  ZapString r = zap_str(s.data);
  for (size_t i=0; i<r.len; i++) r.data[i]=(char)tolower((unsigned char)r.data[i]);
  return r;
}
static double    zap_len_str(ZapString s) { return (double)s.len; }
static int zap_starts_with(ZapString s, ZapString p) {
  return s.len >= p.len && memcmp(s.data, p.data, p.len) == 0;
}
static int zap_ends_with(ZapString s, ZapString p) {
  return s.len >= p.len && memcmp(s.data+s.len-p.len, p.data, p.len) == 0;
}
static ZapString zap_str_repeat(ZapString s, double n) {
  size_t t = s.len * (size_t)n;
  ZapString r; r.data = (char*)malloc(t+1); r.len = t;
  for (size_t i=0; i<(size_t)n; i++) memcpy(r.data+i*s.len, s.data, s.len);
  r.data[t]='\\0'; return r;
}
static ZapString zap_str_trim(ZapString s) {
  size_t a=0, b=s.len;
  while (a<b && isspace((unsigned char)s.data[a])) a++;
  while (b>a && isspace((unsigned char)s.data[b-1])) b--;
  char *d=(char*)malloc(b-a+1); memcpy(d,s.data+a,b-a); d[b-a]='\\0';
  ZapString r; r.data=d; r.len=b-a; return r;
}

/* ──────────────────────────────────────────────
   Range helper
─────────────────────────────────────────────── */
static ZapArray *zap_range(double from, double to, double step) {
  ZapArray *a = zap_arr_new();
  if (step == 0) return a;
  for (double i = from; step > 0 ? i < to : i > to; i += step)
    zap_arr_push(a, zap_val_num(i));
  return a;
}
`.trim()

// ── Type system ──────────────────────────────────────────────────────
type ZapType = "num" | "str" | "bool" | "arr" | "obj" | "val" | "void" | "unknown"

interface Env {
  vars: Map<string, ZapType>
  fns:  Map<string, ZapType>
  parent: Env | null
}

function newEnv(parent: Env | null = null): Env {
  return { vars: new Map(), fns: new Map(), parent }
}

function lookupType(env: Env, name: string): ZapType {
  if (env.vars.has(name)) return env.vars.get(name)!
  if (env.parent) return lookupType(env.parent, name)
  return "unknown"
}

function lookupFnType(env: Env, name: string): ZapType {
  if (env.fns.has(name)) return env.fns.get(name)!
  if (env.parent) return lookupFnType(env.parent, name)
  return "unknown"
}

function inferType(node: Node, env: Env): ZapType {
  switch (node.kind) {
    case "Number":   return "num"
    case "String":
    case "Template": return "str"
    case "Bool":     return "bool"
    case "Null":     return "unknown"
    case "Array":    return "arr"
    case "Object":   return "obj"
    case "Ident":    return lookupType(env, node.name)

    case "BinOp": {
      if (["+","-","*","/","%","**"].includes(node.op)) {
        const lt = inferType(node.left, env)
        const rt = inferType(node.right, env)
        if (lt === "str" || rt === "str") return "str"
        return "num"
      }
      return "bool"
    }
    case "UnaryOp":
      return node.op === "!" ? "bool" : "num"

    case "Index":
      return "unknown" // array element type unknown at compile time

    case "Member": {
      const ot = inferType(node.object, env)
      if (ot === "obj") return "val"   // obj.prop → ZapValue
      return "unknown"
    }

    case "Call": {
      // Method call on array: arr.reverse(), arr.sort(), arr.join(), etc.
      if (node.callee.kind === "Member") {
        const ot = inferType(node.callee.object, env)
        if (ot === "arr") {
          const method = node.callee.prop
          const arrRetArr = new Set(["reverse","sort","slice"])
          const arrRetStr = new Set(["join"])
          const arrRetNum = new Set(["len","indexOf","pop"])
          const arrRetBool= new Set(["includes"])
          if (arrRetArr.has(method))  return "arr"
          if (arrRetStr.has(method))  return "str"
          if (arrRetNum.has(method))  return "num"
          if (arrRetBool.has(method)) return "bool"
        }
        if (ot === "obj") {
          const method = node.callee.prop
          if (method === "keys" || method === "values") return "arr"
        }
        // obj.prop (non-call member) → ZapValue
        if (node.callee.kind === "Member" && inferType((node.callee as any).object, env) === "obj") {
          return "val"
        }
        return "unknown"
      }
      if (node.callee.kind !== "Ident") return "unknown"
      const name = node.callee.name
      const fnRet = lookupFnType(env, name)
      if (fnRet !== "unknown") return fnRet

      const mathFns = new Set(["sqrt","abs","floor","ceil","round","pow","zap_min2","zap_max2","random","randomInt","len","toNumber","toInt","zap_arr_len","zap_arr_index_of"])
      const strFns  = new Set(["upper","lower","trim","toStr","replace","join","zap_arr_join","zap_num_to_str"])
      const boolFns = new Set(["startsWith","endsWith","includes","zap_arr_includes"])
      const arrFns  = new Set(["range","reverse","sort","zap_range","zap_arr_reverse","zap_arr_sort","zap_arr_slice"])
      if (mathFns.has(name)) return "num"
      if (strFns.has(name))  return "str"
      if (boolFns.has(name)) return "bool"
      if (arrFns.has(name))  return "arr"
      return "unknown"
    }
    default: return "unknown"
  }
}

// ── C type string ────────────────────────────────────────────────────
function ctype(t: ZapType): string {
  switch(t) {
    case "str":  return "ZapString"
    case "bool": return "int"
    case "arr":  return "ZapArray*"
    case "obj":  return "ZapObject*"
    case "val":  return "ZapValue"
    default:     return "double"
  }
}

// ── C expression emitter ─────────────────────────────────────────────
function cExpr(node: Node, env: Env): string {
  switch (node.kind) {
    case "Number": return String(node.value)
    case "Bool":   return node.value ? "1" : "0"
    case "Null":   return "zap_val_null()"
    case "String": return `zap_str(${JSON.stringify(node.value)})`

    case "Template": {
      const parts = node.value.split(/\{([^}]+)\}/)
      let result = `zap_str("")`
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          if (parts[i]) result = `zap_str_concat(${result}, zap_str(${JSON.stringify(parts[i])}))`
        } else {
          const inner = parts[i].trim()
          const t = lookupType(env, inner)
          if (t === "str")  result = `zap_str_concat(${result}, ${inner})`
          else if (t === "bool") result = `zap_str_concat(${result}, zap_bool_to_str(${inner}))`
          else               result = `zap_str_concat(${result}, zap_num_to_str(${inner}))`
        }
      }
      return result
    }

    case "Ident": return node.name

    // ── Object literal ───────────────────────────────────────────────
    case "Object":
      // Handled in cStmt VarDecl — inline use falls back to a helper
      return "__zap_obj_inline_unsupported"

    // ── Array literal ────────────────────────────────────────────────
    case "Array": {
      if (node.elements.length === 0) return `zap_arr_new()`
      const lines = [`zap_arr_new()`]
      const tmp = `__arr_${Math.random().toString(36).slice(2,7)}__`
      // We handle this in cStmt for VarDecl — here return a compound literal helper
      // For inline use, emit an init sequence using a block expression (GCC extension)
      // Instead, we generate a named init helper call
      const pushes = node.elements.map(el => {
        const t = inferType(el, env)
        const v = cExpr(el, env)
        if (t === "num" || t === "unknown")  return `zap_val_num(${v})`
        if (t === "str")   return `zap_val_str(${v})`
        if (t === "bool")  return `zap_val_bool(${v})`
        if (t === "arr")   return `zap_val_null()` // nested arrays (basic)
        return `zap_val_num(${v})`
      })
      return `__zap_arr_init(${node.elements.length}, ${pushes.join(", ")})`
    }

    case "BinOp": {
      const lt = inferType(node.left, env)
      const rt = inferType(node.right, env)

      if (node.op === "+" && (lt === "str" || rt === "str")) {
        const l = lt === "str" ? cExpr(node.left, env) : `zap_num_to_str(${cExpr(node.left, env)})`
        const r = rt === "str" ? cExpr(node.right, env) : `zap_num_to_str(${cExpr(node.right, env)})`
        return `zap_str_concat(${l}, ${r})`
      }
      if ((node.op === "===" || node.op === "==") && (lt === "str" || rt === "str"))
        return `zap_str_eq(${cExpr(node.left, env)}, ${cExpr(node.right, env)})`
      if ((node.op === "!==" || node.op === "!=") && (lt === "str" || rt === "str"))
        return `!zap_str_eq(${cExpr(node.left, env)}, ${cExpr(node.right, env)})`
      if (node.op === "**") return `pow(${cExpr(node.left, env)}, ${cExpr(node.right, env)})`
      if (node.op === "%")  return `((double)((long long)${cExpr(node.left, env)} % (long long)${cExpr(node.right, env)}))`

      const op = node.op === "===" ? "==" : node.op === "!==" ? "!=" : node.op
      return `(${cExpr(node.left, env)} ${op} ${cExpr(node.right, env)})`
    }

    case "UnaryOp":  return `${node.op}${cExpr(node.expr, env)}`
    case "PostfixOp":return `${cExpr(node.expr, env)}${node.op}`

    case "Ternary":
      return `(${cExpr(node.cond, env)} ? ${cExpr(node.then, env)} : ${cExpr(node.else, env)})`

    // ── Array indexing ───────────────────────────────────────────────
    case "Index": {
      const ot = inferType(node.object, env)
      if (ot === "arr" || ot === "unknown") {
        return `zap_arr_get(${cExpr(node.object, env)}, ${cExpr(node.index, env)}).num`
      }
      return `${cExpr(node.object, env)}[(int)(${cExpr(node.index, env)})]`
    }

    case "Member": {
      const ot = inferType(node.object, env)
      if (ot === "obj") {
        return `zap_obj_get(${cExpr(node.object, env)}, "${node.prop}")`
      }
      return `${cExpr(node.object, env)}.${node.prop}`
    }

    case "Call": {
      if (node.callee.kind !== "Ident" && node.callee.kind !== "Member") return "0"
      const args = node.args.map(a => cExpr(a, env))

      // Method call on object or array variable
      if (node.callee.kind === "Member") {
        const obj = cExpr(node.callee.object, env)
        const method = node.callee.prop
        const ot = inferType(node.callee.object, env)

        if (ot === "obj") {
          switch (method) {
            case "keys":   return `zap_obj_keys(${obj})`
            case "values": return `zap_obj_values(${obj})`
            case "get":    return `zap_obj_get(${obj}, ${cExpr(node.args[0], env)}.data)`
            case "set":    return `zap_obj_set(${obj}, ${cExpr(node.args[0], env)}.data, ${objVal(node.args[1], env)})`
            case "has":    {
              const key = cExpr(node.args[0], env)
              return `(zap_obj_get(${obj}, ${key}.data).tag != ZAP_NULL)`
            }
          }
        }

        if (ot === "arr") {
          switch(method) {
            case "len":     return `zap_arr_len(${obj})`
            case "push":    return `zap_arr_push(${obj}, ${arrVal(node.args[0], env)})`
            case "pop":     return `zap_arr_pop(${obj}).num`
            case "reverse": return `zap_arr_reverse(${obj})`
            case "sort":    return `zap_arr_sort(${obj})`
            case "join":    return `zap_arr_join(${obj}, ${args[0] ?? 'zap_str(",")'  })`
            case "includes":return `zap_arr_includes(${obj}, ${arrVal(node.args[0], env)})`
            case "indexOf": return `zap_arr_index_of(${obj}, ${arrVal(node.args[0], env)})`
            case "slice":   return `zap_arr_slice(${obj}, ${args[0]??0}, ${args[1]??"-1"})`
          }
        }
        return `${obj}.${method}(${args.join(", ")})`
      }

      const name = (node.callee as any).name

      // print — detect array
      if (name === "print" || name === "println") {
        if (!node.args[0]) return `printf("\\n")`
        const t = inferType(node.args[0], env)
        const C_BUILTINS_SET = new Set(["sqrt","abs","floor","ceil","round","pow","min","max","random","randomInt","upper","lower","len","toNumber","toInt","toStr","startsWith","endsWith","trim","repeat","join","includes","indexOf","reverse","sort","range","push","pop"])
        const isUserFn = node.args[0].kind === "Call" &&
          node.args[0].callee.kind === "Ident" &&
          !C_BUILTINS_SET.has((node.args[0].callee as any).name)

        if (t === "arr")  return `zap_print_arr(${args[0]})`
        if (t === "obj")  return `zap_print_obj_ln(${args[0]})`
        if (t === "val")  return `(zap_print_val(${args[0]}), printf("\\n"))`
        if (t === "bool") return `zap_print_bool(${args[0]})`
        if (t === "str")  return `zap_print_str(${args[0]})`
        if (t === "num" || isUserFn) return `zap_print_num(${args[0]})`
        return `zap_print_num(${args[0]})`
      }

      // Built-ins
      switch(name) {
        case "sqrt":       return `zap_sqrt(${args[0]})`
        case "abs":        return `zap_abs(${args[0]})`
        case "floor":      return `zap_floor(${args[0]})`
        case "ceil":       return `zap_ceil(${args[0]})`
        case "round":      return `zap_round(${args[0]})`
        case "pow":        return `zap_pow(${args[0]}, ${args[1]})`
        case "min":        return `zap_min2(${args[0]}, ${args[1]})`
        case "max":        return `zap_max2(${args[0]}, ${args[1]})`
        case "random":     return `zap_random()`
        case "randomInt":  return `zap_random_int(${args[0]}, ${args[1]})`
        case "upper":      return `zap_upper(${args[0]})`
        case "lower":      return `zap_lower(${args[0]})`
        case "trim":       return `zap_str_trim(${args[0]})`
        case "repeat":     return `zap_str_repeat(${args[0]}, ${args[1]})`
        case "len":        return `zap_len_str(${args[0]})`
        case "toNumber":
        case "toInt":      return `atof(${args[0]}.data)`
        case "toStr":      return `zap_num_to_str(${args[0]})`
        case "startsWith": return `zap_starts_with(${args[0]}, ${args[1]})`
        case "endsWith":   return `zap_ends_with(${args[0]}, ${args[1]})`
        case "join":       return `zap_arr_join(${args[0]}, zap_str(${args[1] ?? '","'}))`
        case "includes":   return `zap_arr_includes(${args[0]}, ${arrVal(node.args[1], env)})`
        case "indexOf":    return `zap_arr_index_of(${args[0]}, ${arrVal(node.args[1], env)})`
        case "reverse":    return `zap_arr_reverse(${args[0]})`
        case "sort":       return `zap_arr_sort(${args[0]})`
        case "push":       return `zap_arr_push(${args[0]}, ${arrVal(node.args[1], env)})`
        case "pop":        return `zap_arr_pop(${args[0]}).num`
        case "range":
          if (args.length === 1) return `zap_range(0, ${args[0]}, 1)`
          return `zap_range(${args[0]}, ${args[1]}, ${args[2] ?? "1"})`
        default:
          return `${name}(${args.join(", ")})`
      }
    }

    default: return "0"
  }
}

// Convert a node to a ZapValue
function toZapVal(node: Node | undefined, env: Env): string {
  if (!node) return "zap_val_null()"
  const t = inferType(node, env)
  const v = cExpr(node, env)
  if (t === "str")  return `zap_val_str(${v})`
  if (t === "bool") return `zap_val_bool(${v})`
  if (t === "arr")  return `zap_val_null()` // nested arrays: TODO
  if (t === "obj")  return `zap_val_obj(${v})`
  return `zap_val_num(${v})`
}
function arrVal(node: Node | undefined, env: Env): string { return toZapVal(node, env) }
function objVal(node: Node | undefined, env: Env): string { return toZapVal(node, env) }

// ── C statement emitter ──────────────────────────────────────────────
function cStmt(node: Node, env: Env, indent: number): string {
  const pad = "    ".repeat(indent)

  switch (node.kind) {
    case "VarDecl": {
      const t = inferType(node.value, env)
      env.vars.set(node.name, t)

      // Object literal — emit as zap_obj_new() + zap_obj_set() calls
      if (t === "obj" && node.value.kind === "Object") {
        env.vars.set(node.name, "obj")
        const lines: string[] = []
        lines.push(`${pad}ZapObject *${node.name} = zap_obj_new();`)
        for (const { key, value } of node.value.pairs) {
          lines.push(`${pad}zap_obj_set(${node.name}, "${key}", ${objVal(value, env)});`)
        }
        return lines.join("\n")
      }

      // Array literal — emit init with __zap_arr_init
      if (t === "arr" && node.value.kind === "Array") {
        const elems = node.value.elements
        const lines: string[] = []
        lines.push(`${pad}ZapArray *${node.name} = zap_arr_new();`)
        for (const el of elems) {
          const et = inferType(el, env)
          const ev = cExpr(el, env)
          let val: string
          if (et === "str")  val = `zap_val_str(${ev})`
          else if (et === "bool") val = `zap_val_bool(${ev})`
          else               val = `zap_val_num(${ev})`
          lines.push(`${pad}zap_arr_push(${node.name}, ${val});`)
        }
        return lines.join("\n")
      }

      const ct = ctype(t)
      return `${pad}${ct} ${node.name} = ${cExpr(node.value, env)};`
    }

    case "Assign": {
      // obj.prop = val
      if (node.target.kind === "Member") {
        const ot = inferType(node.target.object, env)
        if (ot === "obj") {
          const objName = cExpr(node.target.object, env)
          return `${pad}zap_obj_set(${objName}, "${node.target.prop}", ${objVal(node.value, env)});`
        }
      }
      if (node.target.kind !== "Ident") return ""
      const name = (node.target as any).name
      return `${pad}${name} ${node.op} ${cExpr(node.value, env)};`
    }

    case "FnDecl": {
      const childEnv = newEnv(env)
      const callSiteTypes = fnParamTypes.get(node.name) ?? []
      node.params.forEach((p, i) => childEnv.vars.set(p, callSiteTypes[i] ?? "unknown"))
      // Detect return type
      const retType = detectReturnType(node.body, childEnv)
      env.fns.set(node.name, retType)
      const ct = ctype(retType)
      const params = node.params.map((p, i) => {
        const pt = callSiteTypes[i] ?? "unknown"
        return `${ctype(pt)} ${p}`
      }).join(", ") || "void"
      const body = node.body.map(n => cStmt(n, childEnv, indent + 1)).join("\n")
      return `${pad}${ct} ${node.name}(${params}) {\n${body}\n${pad}}`
    }

    case "Return": {
      if (!node.value) return `${pad}return;`
      return `${pad}return ${cExpr(node.value, env)};`
    }

    case "If": {
      let out = `${pad}if (${cExpr(node.cond, env)}) {\n`
      out += node.then.map(n => cStmt(n, newEnv(env), indent + 1)).join("\n")
      out += `\n${pad}}`
      for (const ei of node.elif) {
        out += ` else if (${cExpr(ei.cond, env)}) {\n`
        out += ei.body.map(n => cStmt(n, newEnv(env), indent + 1)).join("\n")
        out += `\n${pad}}`
      }
      if (node.else.length > 0) {
        out += ` else {\n`
        out += node.else.map(n => cStmt(n, newEnv(env), indent + 1)).join("\n")
        out += `\n${pad}}`
      }
      return out
    }

    case "While": {
      return [
        `${pad}while (${cExpr(node.cond, env)}) {`,
        node.body.map(n => cStmt(n, newEnv(env), indent + 1)).join("\n"),
        `${pad}}`
      ].join("\n")
    }

    case "Loop": {
      const loopEnv = newEnv(env)
      loopEnv.vars.set(node.var, "num")
      const step = node.step ? cExpr(node.step, env) : "1"
      return [
        `${pad}for (double ${node.var} = ${cExpr(node.from, env)}; ${node.var} < ${cExpr(node.to, env)}; ${node.var} += ${step}) {`,
        node.body.map(n => cStmt(n, loopEnv, indent + 1)).join("\n"),
        `${pad}}`
      ].join("\n")
    }

    case "Break":    return `${pad}break;`
    case "Continue": return `${pad}continue;`

    case "Call":
    case "PostfixOp":
    case "BinOp":
    case "UnaryOp":
    case "Member":
    case "Ternary":
      return `${pad}${cExpr(node, env)};`

    default:
      return ""
  }
}

function detectReturnType(body: Node[], env: Env): ZapType {
  for (const n of body) {
    if (n.kind === "Return" && n.value) return inferType(n.value, env)
    if (n.kind === "If") {
      const t = detectReturnType(n.then, env)
      if (t !== "void") return t
    }
  }
  return "void"
}

// ── Main entry ───────────────────────────────────────────────────────
/** fn name → per-param types inferred from call sites */
const fnParamTypes: Map<string, ZapType[]> = new Map()

/** Walk all nodes and collect param types from Call sites */
function collectCallSiteTypes(nodes: Node[], env: Env) {
  for (const node of nodes) {
    if (node.kind === "Call" && node.callee.kind === "Ident") {
      const name = node.callee.name
      const argTypes = node.args.map(a => inferType(a, env))
      if (!fnParamTypes.has(name)) {
        fnParamTypes.set(name, argTypes)
      }
    }
    // Recurse into body nodes
    for (const key of ["body","then","else"] as const) {
      if ((node as any)[key]?.length) collectCallSiteTypes((node as any)[key], env)
    }
    if ((node as any)["elif"]) {
      for (const ei of (node as any)["elif"]) collectCallSiteTypes(ei.body, env)
    }
  }
}

export function generateC(program: Node): string {
  if (program.kind !== "Program") throw new Error("Expected Program node")

  fnParamTypes.clear()
  const globalEnv = newEnv()

  // Pre-pass: register variable types from VarDecl so call-site inference works
  const scanEnv = newEnv()
  for (const node of program.body) {
    if (node.kind === "VarDecl") scanEnv.vars.set(node.name, inferType(node.value, scanEnv))
  }
  collectCallSiteTypes(program.body, scanEnv)

  // ── __zap_arr_init helper ─────────────────────────────────────────
  const ARR_INIT_HELPER = `
static ZapArray *__zap_arr_init(int n, ...) {
  ZapArray *a = zap_arr_new();
  va_list ap; va_start(ap, n);
  for (int i = 0; i < n; i++) zap_arr_push(a, va_arg(ap, ZapValue));
  va_end(ap);
  return a;
}
`.trim()

  // ── Forward declarations ──────────────────────────────────────────
  const fwdDecls: string[] = []
  for (const node of program.body) {
    if (node.kind === "FnDecl") {
      const callSiteTypes = fnParamTypes.get(node.name) ?? []
      const retEnv = newEnv(globalEnv)
      node.params.forEach((p, i) => retEnv.vars.set(p, callSiteTypes[i] ?? "unknown"))
      const retType = detectReturnType(node.body, retEnv)
      const ct = ctype(retType)
      const params = node.params.map((p, i) => `${ctype(callSiteTypes[i] ?? "unknown")} ${p}`).join(", ") || "void"
      fwdDecls.push(`${ct} ${node.name}(${params});`)
      globalEnv.fns.set(node.name, retType)
    }
  }

  // ── Separate fn defs from main stmts ─────────────────────────────
  const fnDefs: string[] = []
  const mainStmts: string[] = []

  for (const node of program.body) {
    if (node.kind === "FnDecl") {
      fnDefs.push(cStmt(node, globalEnv, 0))
    } else {
      mainStmts.push(cStmt(node, globalEnv, 1))
    }
  }

  const lines: string[] = [
    "/* Generated by Zap compiler ⚡ — https://github.com/developermickey/zaplang */",
    "#include <stdarg.h>",
    C_RUNTIME,
    "",
    ARR_INIT_HELPER,
    "",
  ]

  if (fwdDecls.length > 0) {
    lines.push("/* Forward declarations */")
    lines.push(...fwdDecls)
    lines.push("")
  }
  if (fnDefs.length > 0) {
    lines.push(...fnDefs)
    lines.push("")
  }

  lines.push("int main(void) {")
  lines.push("    srand((unsigned)time(NULL));")
  lines.push(...mainStmts)
  lines.push("    return 0;")
  lines.push("}")

  return lines.join("\n") + "\n"
}
