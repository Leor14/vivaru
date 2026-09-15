# Recálculo del lote con la v0.4 (cada estimación × su propio nivel).
# Notas: D,O,R,A,I,Rq,DU,Des,Ci,U. Niveles solo de las estimaciones (D,O,R,I,Rq,DU,U).
EST = ["D","O","R","I","Rq","DU","U"]
def parse(n, lv):
    k = dict(zip(["D","O","R","A","I","Rq","DU","Des","Ci","U"], n)); return k, lv
L = {
 "L-01b":([1,0,0,1,1,0,0,0,0,0],{"D":.8,"I":.8},2.6,"B",1,1.3),
 "L-03": ([1,0,0,1,1,1,1,0,0,0],{"D":.8,"I":.8,"Rq":.8,"DU":.8},.85,"B",1,2.1),
 "L-04": ([0,1,0,1,2,2,0,0,2,0],{"O":.5,"I":.8,"Rq":.5},.5,"B",1,2.75),
 "L-05": ([1,1,0,2,1,0,1,0,0,0],{"D":.8,"O":.5,"I":.5,"DU":.8},3.75,"B",1,2.0),
 "L-06": ([1,0,1,1,1,0,1,1,0,0],{"D":.8,"R":.5,"I":.8,"DU":.8},1.0,"B",1,2.0),
 "L-07": ([1,0,1,1,1,0,1,0,1,0],{"D":.8,"R":.5,"I":.8,"DU":.8},1.0,"A",1,2.0),
 "L-08": ([3,2,1,3,1,1,2,1,1,0],{"D":.5,"O":.5,"R":.5,"I":.5,"Rq":.5,"DU":.8},1.5,"A/B",1,5.0),
 "L-09": ([1,0,1,2,1,0,1,0,1,0],{"D":.8,"R":.5,"I":.5,"DU":.8},1.3,"B",1,2.5),
 "L-10": ([2,0,1,2,1,0,2,0,1,0],{"D":.8,"R":.5,"I":.5,"DU":.8},2.0,"B",1,3.9),
 "L-29": ([2,1,1,2,1,1,2,0,0,0],{"D":.8,"O":.5,"R":.5,"I":.5,"Rq":.5,"DU":.8},1.8,"A",1,4.2),
 "L-30": ([1,1,2,2,1,0,1,0,0,0],{"D":.8,"O":.5,"R":.3,"I":.5,"DU":.8},2.8,"B",1,1.9),
 "L-13": ([1,1,0,1,1,0,1,0,0,0],{"D":.8,"O":.5,"I":.8,"DU":.8},1.5,"A",1,1.5),
 "L-14": ([1,1,0,1,1,0,1,0,0,0],{"D":.8,"O":.5,"I":.8,"DU":.8},1.1,"B",1,1.5),
 "L-15": ([1,0,0,2,1,0,1,0,0,0],{"D":.8,"I":.8,"DU":.8},1.0,"B",1,2.2),
 "L-16": ([1,0,0,2,1,0,0,0,0,0],{"D":.8,"I":.8},1.1,"B",1,1.8),
 "L-17": ([1,0,0,2,1,0,0,0,0,0],{"D":.8,"I":.8},.5,"B",1,1.8),
 "L-18": ([1,1,0,2,2,1,1,0,0,0],{"D":.8,"O":.8,"I":.8,"Rq":.5,"DU":.8},1.1,"B",1,3.4),
 "L-31": ([0,0,0,1,1,0,0,0,0,0],{"I":.8},2.4,"C",1,0.9),
 "L-19": ([1,1,1,3,2,0,2,0,1,0],{"D":.8,"O":.5,"R":.5,"I":.8,"DU":.8},1.9,"B",1,4.8),
 "L-20": ([1,1,1,2,2,0,1,0,0,0],{"D":.8,"O":.5,"R":.5,"I":.8,"DU":.8},1.2,"A",1,3.4),
 "L-21": ([1,1,2,2,2,0,2,0,0,0],{"D":.8,"O":.5,"R":.5,"I":.8,"DU":.8},1.8,"A",1,3.0),
 "L-21d":([1,0,1,1,2,1,0,0,1,1],{"D":.5,"R":.5,"I":1.0,"Rq":1.0,"U":.5},1.1,"A",0,5.5),
 "L-32": ([1,1,1,2,2,0,1,1,0,0],{"D":.8,"O":.5,"R":.8,"I":.8,"DU":.5},1.3,"B",1,3.9),
 "L-32b":([1,1,1,2,2,0,0,0,0,0],{"D":.8,"O":.8,"R":.8,"I":.8},8.0,"C",1,3.0),
 "L-22": ([1,0,1,1,1,3,1,0,0,0],{"D":.8,"R":.5,"I":.8,"Rq":.5,"DU":.8},.85,"A",1,2.25),
 "L-23": ([2,2,1,2,1,2,2,0,0,0],{"D":.5,"O":.5,"R":.5,"I":.8,"Rq":.5,"DU":.8},1.4,"A",1,3.5),
 "L-24": ([1,0,1,1,1,0,2,0,0,0],{"D":.8,"R":.5,"I":.8,"DU":.8},.9,"A",1,2.5),
 "L-25": ([1,0,0,1,1,0,1,0,0,0],{"D":.8,"I":.8,"DU":.8},2.0,"B",1,1.7),
 "L-26": ([1,1,1,2,1,0,1,0,0,0],{"D":.8,"O":.8,"R":.8,"I":.5,"DU":.8},2.6,"B",1,2.25),
 "L-27": ([1,1,1,1,1,0,1,0,2,0],{"D":.8,"O":.5,"R":.8,"I":1.0,"DU":.8},.45,"A",1,2.75),
 "L-28": ([1,1,1,2,1,0,1,0,0,0],{"D":.8,"O":.8,"R":.8,"I":.5,"DU":.8},3.3,"B",1,2.25),
}
T3 = {  # tercera calibración (sin Ingreso de prospecto)
 "FEAT-004":([1,3,2,2,2,1,2,2,0,0],{"D":.5,"O":.5,"R":.5,"I":.5,"Rq":.3,"DU":.5},2.3,4.75),
 "FLOW-003":([2,1,1,2,1,2,2,0,0,0],{k:.5 for k in EST},3.0,3.25),
 "PLAT-006":([1,1,2,2,0,2,0,1,1,1],{"D":.5,"O":.5,"R":.5,"Rq":.5,"U":.3},2.5,4.5),
 "FEAT-006":([2,0,1,1,1,1,1,1,1,0],{k:.5 for k in EST},1.7,3.0),
 "PLAT-004":([2,2,2,2,1,0,2,2,1,0],{"D":.5,"O":.5,"R":.5,"I":.5,"DU":.8},1.4,4.75),
 "FEAT-007":([0,1,0,3,1,1,0,1,1,0],{"O":.3,"I":.5,"Rq":.5},3.3,2.95),
}
def v03(n, lv):
    k,_ = parse(n, lv)
    E = .5*(k["D"]+k["O"]+k["R"]) + .5*(k["I"]+k["Rq"]+k["DU"]) + 2*k["U"]
    H = .5*k["A"] + .5*(k["Des"]+k["Ci"])
    ge2 = [lv[e] for e in EST if k[e] >= 2]; ge1 = [lv[e] for e in EST if k[e] >= 1]
    C = min(ge2) if ge2 else (min(ge1) if ge1 else 1.0)
    return H + E*C
def v04(n, lv):
    k,_ = parse(n, lv)
    w = {"D":.5,"O":.5,"R":.5,"I":.5,"Rq":.5,"DU":.5,"U":2}
    E = sum(w[e]*k[e]*lv.get(e,0) for e in EST)
    H = .5*k["A"] + .5*(k["Des"]+k["Ci"])
    return H + E
def cuad(ia, h, u): return ("Ganancia rápida" if h < 4 else "Apuesta") if ia >= u else ("Relleno" if h < 4 else "Pozo")
print("== Control: la v0.3 recalculada contra lo que dieron los agentes ==")
bad = 0
for id_,(n,lv,h,fr,req,ia_ag) in L.items():
    x = v03(n,lv)
    if abs(x-ia_ag) > 0.06: bad += 1; print(f"  DIFIERE {id_}: script {x:.2f} · agente {ia_ag}")
for id_,(n,lv,h,ia_ag) in T3.items():
    x = v03(n,lv)
    if abs(x-ia_ag) > 0.06: bad += 1; print(f"  DIFIERE {id_}: script {x:.2f} · agente {ia_ag}")
print(f"  diferencias: {bad} de {len(L)+len(T3)}")
print("\n== Tercera calibración con la v0.4 (sin prospecto) ==")
for id_,(n,lv,h,_) in T3.items():
    a, b = v03(n,lv), v04(n,lv)
    print(f"  {id_:9s} v0.3 {a:5.2f} → v0.4 {b:5.2f} · h {h} · umbral 4: {cuad(b,h,4):16s} · umbral 5: {cuad(b,h,5)}")
print("\n== El lote con la v0.4 y el Ingreso de prospecto ==")
rows = []
for id_,(n,lv,h,fr,req,_) in L.items():
    n2, lv2 = list(n), dict(lv)
    if req and n2[4] < 2: n2[4] = 2; lv2["I"] = .8
    elif req: lv2["I"] = max(lv2.get("I",0), .8)
    a, b = v03(n,lv), v04(n2,lv2)
    rows.append((b/h, id_, a, b, h, fr))
for p, id_, a, b, h, fr in sorted(rows, reverse=True):
    print(f"  {id_:6s} freno {fr:4s} IA v0.3 {a:5.2f} → v0.4 {b:5.2f} · h {h:4.2f} · punt {p:5.2f} · u4 {cuad(b,h,4):16s} · u5 {cuad(b,h,5)}")
import statistics
vals = [r[3] for r in rows]; print(f"\n  IA v0.4: mínimo {min(vals):.2f} · mediana {statistics.median(vals):.2f} · máximo {max(vals):.2f}")
for u in (4,4.5,5,5.5):
    g = sum(1 for r in rows if r[3] >= u and r[4] < 4); print(f"  con umbral {u}: {g} Ganancias rápidas de {len(rows)}")
