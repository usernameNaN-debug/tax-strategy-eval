"""Simple US federal individual income tax engine for TY2022 / TY2025 / TY2026.

Covers what the benchmark households need: brackets, standard deduction (+65 add-on),
OBBBA Schedule 1-A deductions (senior, tips, overtime, car-loan interest), QDCG worksheet,
Social Security taxation (Pub 915), SE tax, QBI (below threshold), SEP/SEHI, SALT cap with
OBBBA phase-down, NIIT, simple AMT check, CDCC, Saver's credit, CTC/ODC/ACTC (Sch 8812),
EITC (formula, not table), simple excise items.
"""
import math

INF = float("inf")

P = {}

P[2025] = dict(
    brackets={
        "single": [(11925, .10), (48475, .12), (103350, .22), (197300, .24), (250525, .32), (626350, .35), (INF, .37)],
        "mfj": [(23850, .10), (96950, .12), (206700, .22), (394600, .24), (501050, .32), (751600, .35), (INF, .37)],
        "hoh": [(17000, .10), (64850, .12), (103350, .22), (197300, .24), (250500, .32), (626350, .35), (INF, .37)],
    },
    std={"single": 15750, "mfj": 31500, "hoh": 23625},
    addl65={"single": 2000, "hoh": 2000, "mfj": 1600},
    ltcg0={"single": 48350, "mfj": 96700, "hoh": 64750},
    ltcg15={"single": 533400, "mfj": 600050, "hoh": 566700},
    senior=6000, senior_thr={"single": 75000, "hoh": 75000, "mfj": 150000}, senior_rate=0.06,
    tips_cap=25000, ot_cap={"single": 12500, "hoh": 12500, "mfj": 25000}, tipsot_thr={"single": 150000, "hoh": 150000, "mfj": 300000},
    car_cap=10000, car_thr={"single": 100000, "hoh": 100000, "mfj": 200000},
    salt_cap=40000, salt_thr=500000, salt_floor=10000, salt_rate=0.30,
    charity_floor=0.0,
    ctc=2200, actc=1700, odc=500, ctc_thr={"single": 200000, "hoh": 200000, "mfj": 400000},
    eitc={  # n: (earned income amt, max credit, phase-in rate, phaseout rate, thr other, thr mfj)
        0: (8490, 649, .0765, .0765, 10620, 17730),
        1: (12730, 4328, .34, .1598, 23350, 30470),
        2: (17880, 7152, .40, .2106, 23350, 30470),
        3: (17880, 8046, .45, .2106, 23350, 30470),
    },
    eitc_inv_limit=11950,
    savers={"mfj": (47500, 51000, 79000), "hoh": (35625, 38250, 59250), "single": (23750, 25500, 39500)},
    ss_wage_base=176100,
    amt_exempt={"mfj": 137000, "single": 88100, "hoh": 88100}, amt_po={"mfj": 1252700, "single": 626350, "hoh": 626350}, amt_28=239100,
    cdcc_rule="2025",
    sch1a=True,
)

P[2026] = dict(P[2025])
P[2026].update(
    brackets={
        "single": [(12400, .10), (50400, .12), (105700, .22), (201775, .24), (256225, .32), (640600, .35), (INF, .37)],
        "mfj": [(24800, .10), (100800, .12), (211400, .22), (403550, .24), (512450, .32), (768700, .35), (INF, .37)],
        "hoh": [(17700, .10), (67450, .12), (105700, .22), (201750, .24), (256200, .32), (640600, .35), (INF, .37)],
    },
    std={"single": 16100, "mfj": 32200, "hoh": 24150},
    addl65={"single": 2050, "hoh": 2050, "mfj": 1650},
    ltcg0={"single": 49450, "mfj": 98900, "hoh": 66200},
    ltcg15={"single": 545500, "mfj": 613700, "hoh": 579600},
    salt_cap=40400, salt_thr=505000,
    charity_floor=0.005,
    eitc={
        0: (8680, 664, .0765, .0765, 10860, 18140),
        1: (13020, 4427, .34, .1598, 23890, 31160),
        2: (18290, 7316, .40, .2106, 23890, 31160),
        3: (18290, 8231, .45, .2106, 23890, 31160),
    },
    cdcc_rule="2026",
)

P[2022] = dict(
    brackets={
        "single": [(10275, .10), (41775, .12), (89075, .22), (170050, .24), (215950, .32), (539900, .35), (INF, .37)],
        "mfj": [(20550, .10), (83550, .12), (178150, .22), (340100, .24), (431900, .32), (647850, .35), (INF, .37)],
        "hoh": [(14650, .10), (55900, .12), (89050, .22), (170050, .24), (215950, .32), (539900, .35), (INF, .37)],
    },
    std={"single": 12950, "mfj": 25900, "hoh": 19400},
    addl65={"single": 1750, "hoh": 1750, "mfj": 1400},
    ltcg0={"single": 41675, "mfj": 83350, "hoh": 55800},
    ltcg15={"single": 459750, "mfj": 517200, "hoh": 488500},  # not exercised by any scenario
    salt_cap=10000, salt_thr=INF, salt_floor=10000, salt_rate=0.0,
    charity_floor=0.0,
    ctc=2000, actc=1500, odc=500, ctc_thr={"single": 200000, "hoh": 200000, "mfj": 400000},
    eitc={
        0: (7320, 560, .0765, .0765, 9160, 15290),
        1: (10980, 3733, .34, .1598, 20130, 26260),
        2: (15410, 6164, .40, .2106, 20130, 26260),
        3: (15410, 6935, .45, .2106, 20130, 26260),
    },
    eitc_inv_limit=10300,
    savers={"mfj": (41000, 44000, 68000), "hoh": (30750, 33000, 51000), "single": (20500, 22000, 34000)},
    ss_wage_base=147000,
    amt_exempt={"mfj": 118100, "single": 75900, "hoh": 75900}, amt_po={"mfj": 1079800, "single": 539900, "hoh": 539900}, amt_28=206100,
    cdcc_rule="2025",
    sch1a=False,
)


def bracket_tax(ti, status, yr):
    tax, lo = 0.0, 0.0
    for hi, r in P[yr]["brackets"][status]:
        if ti > lo:
            tax += (min(ti, hi) - lo) * r
        lo = hi
    return tax


def qdcg_tax(ti, pref, status, yr):
    """Qualified Dividends and Capital Gain Tax Worksheet."""
    p = P[yr]
    pref = max(0.0, min(pref, ti))
    ordinary = ti - pref
    z = p["ltcg0"][status]
    f = p["ltcg15"][status]
    at0 = max(0.0, min(ti, z) - ordinary)
    rem = pref - at0
    at15 = max(0.0, min(rem, f - max(ordinary, z)))
    at20 = rem - at15
    t = bracket_tax(ordinary, status, yr) + 0.15 * at15 + 0.20 * at20
    return min(t, bracket_tax(ti, status, yr))


def ss_taxable(ss, other, status):
    if ss <= 0:
        return 0.0
    base, adj = (32000, 44000) if status == "mfj" else (25000, 34000)
    pi = 0.5 * ss + other
    if pi <= base:
        return 0.0
    if pi <= adj:
        return min(0.5 * ss, 0.5 * (pi - base))
    return min(0.85 * ss, 0.85 * (pi - adj) + min(0.5 * ss, 0.5 * (adj - base)))


def compute(yr, status, x):
    p = P[yr]
    g = lambda k, d=0.0: x.get(k, d)
    out = {}
    # --- Self-employment
    net_c = g("sched_c_net")
    se_tax = 0.0
    if net_c > 0:
        nese = 0.9235 * net_c
        if nese >= 400:
            se_tax = 0.124 * min(nese, max(0.0, p["ss_wage_base"] - g("ss_wages"))) + 0.029 * nese
    half_se = se_tax / 2
    sep = g("sep")
    sehi = min(g("sehi_premiums"), max(0.0, net_c - half_se - sep - g("solo401k_deferral"))) if net_c > 0 else 0.0
    out.update(se_tax=se_tax, half_se=half_se, sehi=sehi)
    # --- Capital gains
    st, lt = g("st_gain"), g("lt_gain")
    net_cg = st + lt
    cg_in_income = max(-3000.0, net_cg)
    net_ltcg_pref = max(0.0, min(lt, net_cg))
    pref = g("qual_div") + net_ltcg_pref
    # --- Income
    other = (g("wages") + g("interest") + g("ord_div") + cg_in_income + g("ira_taxable") + g("pension_taxable")
             + net_c + g("other_income"))
    adjustments = half_se + sep + sehi + g("hsa_ded") + g("ira_ded") + g("other_adj") + g("solo401k_deferral")
    ss_tax = ss_taxable(g("ss_benefits"), other - adjustments + g("tax_exempt_int"), status)
    agi = other + ss_tax - adjustments
    out.update(other_income_total=other, ss_taxable=ss_tax, adjustments=adjustments, agi=agi)
    # --- Deductions
    n65 = g("n65", 0)
    std = p["std"][status] + n65 * p["addl65"][status]
    salt_cap = max(p["salt_floor"], p["salt_cap"] - p["salt_rate"] * max(0.0, agi - p["salt_thr"]))
    if yr == 2022:
        salt_cap = 10000
    salt = min(g("salt_paid"), salt_cap)
    medical = max(0.0, g("medical") - 0.075 * agi)
    charity = g("charity")
    charity_item = max(0.0, charity - p["charity_floor"] * agi)
    itemized = salt + g("mortgage_int") + charity_item + medical
    force = x.get("force_itemize", False)
    itemizing = force or itemized > std
    ded = itemized if itemizing else std
    out.update(std=std, itemized=itemized, salt_cap=salt_cap, salt_allowed=salt, itemizing=itemizing, deduction=ded)
    # 2026+: non-itemizer charitable deduction ($1,000 / $2,000), cash to public charities
    nonitem_char = 0.0
    if yr >= 2026 and not itemizing:
        nonitem_char = min(g("charity_cash_public", charity), 2000 if status == "mfj" else 1000)
    # --- Schedule 1-A (2025-2028)
    sch1a = 0.0
    det = {}
    if p["sch1a"]:
        magi = agi
        # senior
        n_sen = g("n_senior", 0)
        per = max(0.0, p["senior"] - p["senior_rate"] * max(0.0, magi - p["senior_thr"][status]))
        det["senior"] = n_sen * per
        # tips
        tips = min(g("tips"), p["tips_cap"])
        red = 100 * math.floor(max(0.0, magi - p["tipsot_thr"][status]) / 1000)
        det["tips"] = max(0.0, tips - red)
        # overtime
        ot = min(g("ot_premium"), p["ot_cap"][status])
        det["ot"] = max(0.0, ot - red)
        # car loan
        cl = min(g("car_loan_int"), p["car_cap"])
        red_c = 200 * math.ceil(max(0.0, magi - p["car_thr"][status]) / 1000)
        det["car"] = max(0.0, cl - red_c)
        sch1a = sum(det.values())
    out["sch1a"] = det
    # --- QBI (assumes TI below threshold; non-SSTB irrelevant)
    ti_before_qbi = max(0.0, agi - ded - sch1a - nonitem_char)
    qbi = 0.0
    if net_c > 0 and not x.get("no_qbi"):
        qbi_base = net_c - half_se - sehi - sep - g("solo401k_deferral")
        qbi = max(0.0, min(0.2 * qbi_base, 0.2 * max(0.0, ti_before_qbi - pref)))
    out["qbi"] = qbi
    ti = max(0.0, ti_before_qbi - qbi)
    out["taxable_income"] = ti
    tax = qdcg_tax(ti, pref, status, yr)
    # --- AMT (simple: add back SALT if itemizing, else std ded; ignores other prefs)
    amti = ti + (salt if itemizing else 0.0)
    ex = max(0.0, p["amt_exempt"][status] - 0.25 * max(0.0, amti - p["amt_po"][status]))
    base_amt = max(0.0, amti - ex)
    pref_amt = min(pref, base_amt)
    ord_amt = base_amt - pref_amt
    tmt_ord = 0.26 * min(ord_amt, p["amt_28"]) + 0.28 * max(0.0, ord_amt - p["amt_28"])
    # pref portion taxed at same cap-gain rates (approx: reuse regular worksheet split)
    tmt = tmt_ord + (qdcg_tax(ti, pref, status, yr) - bracket_tax(ti - min(pref, ti), status, yr))
    amt = max(0.0, tmt - tax) if itemizing else 0.0
    out.update(regular_tax=tax, amt=amt)
    tax_total_before_credits = tax + amt
    # --- Credits (nonrefundable order: CDCC, Saver's, CTC/ODC)
    # CDCC
    n_care = g("n_care", 0)
    cdcc = 0.0
    if n_care:
        cap = (3000 if n_care == 1 else 6000) - g("dcfsa")
        exp = max(0.0, min(g("care_exp") - g("dcfsa"), cap, g("lower_earner", INF)))
        if p["cdcc_rule"] == "2025":
            rate = max(20, 35 - math.ceil(max(0.0, agi - 15000) / 2000)) / 100
        else:
            r = max(35, 50 - math.ceil(max(0.0, agi - 15000) / 2000))
            thr2, step = (150000, 4000) if status == "mfj" else (75000, 2000)
            r = max(20, r - math.ceil(max(0.0, agi - thr2) / step))
            rate = r / 100
        cdcc = min(rate * exp, tax_total_before_credits)
    # Saver's
    savers = 0.0
    contribs = x.get("savers_contrib", [])
    if contribs:
        a, b, c = p["savers"][status]
        rate = .5 if agi <= a else .2 if agi <= b else .1 if agi <= c else 0.0
        savers = min(sum(min(cc, 2000) for cc in contribs) * rate, max(0.0, tax_total_before_credits - cdcc))
    # CTC / ODC
    n_ctc, n_odc = g("n_ctc", 0), g("n_odc", 0)
    ctc_total = n_ctc * p["ctc"] + n_odc * p["odc"]
    ctc_total = max(0.0, ctc_total - 50 * math.ceil(max(0.0, agi - p["ctc_thr"][status]) / 1000))
    limit = max(0.0, tax_total_before_credits - cdcc - savers)
    ctc_nonref = min(ctc_total, limit)
    ei = g("wages") + max(0.0, net_c - half_se) if net_c > 0 else g("wages")
    actc = 0.0
    if n_ctc:
        actc = min(ctc_total - ctc_nonref, n_ctc * p["actc"], 0.15 * max(0.0, ei - 2500))
    # EITC
    eitc = 0.0
    if "eitc_children" in x:
        inv = g("interest") + g("ord_div") + max(0.0, net_cg) + g("tax_exempt_int")
        if inv <= p["eitc_inv_limit"]:
            n = min(int(x["eitc_children"]), 3)
            eia, mx, rin, rpo, thr_o, thr_j = p["eitc"][n]
            thr = thr_j if status == "mfj" else thr_o
            c1 = min(rin * ei, mx)
            def po(inc):
                return max(0.0, mx - rpo * max(0.0, inc - thr))
            eitc = min(c1, po(ei))
            if agi > thr:
                eitc = min(eitc, po(agi))
            eitc = max(0.0, eitc)
    income_tax = tax_total_before_credits - cdcc - savers - ctc_nonref
    # NIIT
    nii = g("interest") + g("ord_div") + max(-3000.0, net_cg)
    niit_thr = 250000 if status == "mfj" else 200000
    niit = 0.038 * max(0.0, min(nii, agi - niit_thr))
    other_taxes = se_tax + niit + g("excise") + g("penalty")
    total_tax = income_tax + other_taxes
    refundable = actc + eitc
    payments = g("withholding") + g("est_payments")
    out.update(cdcc=cdcc, savers=savers, ctc_nonref=ctc_nonref, actc=actc, eitc=eitc, income_tax_after_nonref=income_tax,
               niit=niit, other_taxes=other_taxes, total_tax=total_tax, refundable=refundable,
               net_federal_burden=total_tax - refundable, refund=payments + refundable - total_tax, earned_income=ei,
               nonitem_char=nonitem_char)
    return out


def fmt(o, keys=None):
    keys = keys or ["agi", "deduction", "sch1a", "qbi", "taxable_income", "regular_tax", "amt", "cdcc", "savers", "ctc_nonref",
                    "actc", "eitc", "se_tax", "niit", "total_tax", "net_federal_burden", "refund"]
    parts = []
    for k in keys:
        v = o.get(k)
        if isinstance(v, float):
            parts.append(f"{k}={v:,.2f}")
        else:
            parts.append(f"{k}={v}")
    return ", ".join(parts)
