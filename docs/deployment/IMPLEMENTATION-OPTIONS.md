# Implementation Options: API Call Protection

## Option 1: Global Single-Extraction Lock (RECOMMENDED)
**Only allows 1 extraction to run at a time - PERIOD**

### Pros:
✅ **Maximum cost protection** - Impossible to waste credits on parallel calls
✅ **Simpler logic** - Single boolean flag, no complex tracking
✅ **Catches ALL bugs** - Doesn't matter what caused the duplicate, it's blocked
✅ **Foolproof** - No edge cases to worry about
✅ **Easier to debug** - Clear "busy" state

### Cons:
⚠️ **Can't run multiple different searches simultaneously** - Users must wait
⚠️ **Might frustrate power users** - If they want to run dentist + physical therapist at same time

### Use Case:
Perfect for:
- Single user platforms
- Cost-sensitive applications
- When you want absolute guarantee of no parallel calls
- Your exact situation (prevent €25 credit waste)

---

## Option 2: Per-Fingerprint Deduplication
**Only blocks identical searches from running simultaneously**

### Pros:
✅ **Allows different searches in parallel** - "dentist Amsterdam" + "physical therapist Rotterdam" can run together
✅ **More flexible** - Power users can run multiple extractions
✅ **Better UX for multi-user scenarios** - Different users don't block each other

### Cons:
⚠️ **More complex** - Requires Map tracking and cleanup
⚠️ **Edge cases exist** - What if parameters are slightly different?
⚠️ **Doesn't prevent ALL duplicates** - Only blocks identical searches

### Use Case:
Perfect for:
- Multi-user platforms
- When parallel different searches are desired
- Production SaaS with multiple customers

---

## Comparison Table

| Feature | Global Lock | Per-Fingerprint |
|---------|-------------|-----------------|
| **Cost Protection** | ⭐⭐⭐⭐⭐ Maximum | ⭐⭐⭐⭐ Good |
| **Simplicity** | ⭐⭐⭐⭐⭐ Very Simple | ⭐⭐⭐ Moderate |
| **Flexibility** | ⭐⭐ Limited | ⭐⭐⭐⭐⭐ Very Flexible |
| **Edge Cases** | ⭐⭐⭐⭐⭐ None | ⭐⭐⭐ Some |
| **Multi-User** | ⭐⭐ Blocks all | ⭐⭐⭐⭐ Works well |
| **Debugging** | ⭐⭐⭐⭐⭐ Crystal clear | ⭐⭐⭐⭐ Clear |

---

## My Recommendation: **Option 1 (Global Lock)**

**Why:**
Your specific bug scenario shows that **unexpected parallel calls** are the problem. A global lock is:
- Simpler to implement (5 lines vs 15 lines)
- Impossible to bypass
- Exactly what you need to prevent this from happening again

**When to use Option 2:**
- If you later need multiple users to extract simultaneously
- If you want to allow different categories in parallel
- If you're building a SaaS with concurrent usage

**You can always start with Option 1 and upgrade to Option 2 later if needed!**
