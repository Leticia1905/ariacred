import { useState, useEffect } from "react";
import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";
import {
  collection, addDoc, onSnapshot,
  updateDoc, doc, deleteDoc, query, orderBy
} from "firebase/firestore";

// ─── LOGO ────────────────────────────────────────────────────
const LOGO = "data:image/png;base64,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";

// ─── CORES ───────────────────────────────────────────────────
const G = "#C9A84C";
const BG = "#000";
const S1 = "#0a0a0a";
const S2 = "#111";
const S3 = "#161616";
const GR = "#22c55e";
const RD = "#ef4444";
const BL = "#3b82f6";
const PU = "#a855f7";

// ─── UTILS ───────────────────────────────────────────────────
const fmt = v => "R$ " + Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2});
const fmtK = v => v>=1e6?"R$ "+(v/1e6).toFixed(2)+"M":v>=1e3?"R$ "+(v/1e3).toFixed(1)+"k":"R$ "+Number(v||0).toFixed(0);
const hoje = () => new Date().toLocaleDateString("pt-BR");
const diaHoje = () => new Date().getDate();
const saud = () => { const h=new Date().getHours(); return h<12?"Bom dia":h<18?"Boa tarde":"Boa noite"; };
const nomeDisplay = u => u?.displayName || u?.email?.split("@")[0] || "Usuário";

// ─── ESTILOS BASE ────────────────────────────────────────────
const css = {
  app: { background:BG, minHeight:"100vh", color:"#fff", fontFamily:"'DM Sans',sans-serif" },
  wrap: { maxWidth:900, margin:"0 auto", padding:"0 0 80px" },
  card: { background:S2, borderRadius:16, padding:20, marginBottom:16, border:"1px solid #1c1c1c" },
  cardG: { background:"linear-gradient(135deg,#0a0f0a,#0d0d0d)", borderRadius:16, padding:20, marginBottom:16, border:`1px solid ${G}33` },
  inp: { background:S1, border:"1px solid #222", borderRadius:10, padding:"12px 14px", color:"#fff", fontSize:14, width:"100%", outline:"none", fontFamily:"'DM Sans',sans-serif", transition:"border .2s" },
  lbl: { fontSize:11, color:"#555", marginBottom:5, display:"block", letterSpacing:.5, textTransform:"uppercase" },
  btn: (c,light=false) => ({ background:c, color:light?"#000":"#fff", border:"none", borderRadius:10, padding:"12px 20px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", transition:"opacity .2s", whiteSpace:"nowrap" }),
  btnSm: (c,light=false) => ({ background:c, color:light?"#000":"#fff", border:"none", borderRadius:8, padding:"7px 13px", fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }),
  btnO: c => ({ background:"transparent", color:c, border:`1px solid ${c}44`, borderRadius:10, padding:"11px 18px", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }),
  badge: c => ({ display:"inline-flex", alignItems:"center", gap:4, background:c+"18", color:c, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }),
  modal: { position:"fixed", inset:0, background:"#000000dd", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" },
  sheet: { background:S1, borderRadius:"20px 20px 0 0", padding:24, width:"100%", maxWidth:600, maxHeight:"92vh", overflowY:"auto", border:`1px solid #1c1c1c` },
  divider: { height:1, background:"#1a1a1a", margin:"14px 0" },
  row: { display:"flex", gap:12, flexWrap:"wrap" },
  col: { flex:1, minWidth:140 },
  tabStyle: (active) => ({
    flex:"none",
    padding:"12px 16px",
    fontSize:11,
    fontWeight:active?700:400,
    color:active?G:"#555",
    background:"none",
    border:"none",
    borderBottom:active?`2px solid ${G}`:"2px solid transparent",
    cursor:"pointer",
    fontFamily:"'DM Sans',sans-serif",
    whiteSpace:"nowrap",
    letterSpacing:.5,
    position:"relative"
  }),
};

// ─── LOGIN ────────────────────────────────────────────────────
function Login() {
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [name,setName]=useState("");
  const [mode,setMode]=useState("login");
  const [err,setErr]=useState("");
  const [load,setLoad]=useState(false);

  const handle = async () => {
    if(!email||!pass){setErr("Preencha e-mail e senha.");return;}
    setLoad(true); setErr("");
    try {
      if(mode==="login"){
        await signInWithEmailAndPassword(auth,email,pass);
      } else {
        if(!name){setErr("Digite seu nome.");setLoad(false);return;}
        const cred = await createUserWithEmailAndPassword(auth,email,pass);
        await updateProfile(cred.user,{displayName:name});
      }
    } catch(e) {
      const msgs = {
        "auth/wrong-password":"Senha incorreta.",
        "auth/user-not-found":"E-mail não cadastrado.",
        "auth/invalid-credential":"E-mail ou senha incorretos.",
        "auth/email-already-in-use":"E-mail já cadastrado.",
        "auth/weak-password":"Senha fraca — mínimo 6 caracteres.",
      };
      setErr(msgs[e.code]||"Erro ao entrar. Tente novamente.");
    }
    setLoad(false);
  };

  return (
    <div style={{...css.app, display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", padding:20}}>
      <div style={{width:"100%", maxWidth:400}}>
        <div style={{textAlign:"center", marginBottom:40}}>
          <div style={{width:80,height:80,borderRadius:16,background:G,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,fontWeight:800,color:"#000",fontFamily:"'Syne',sans-serif",margin:"0 auto 16px"}}>A</div>
          <div style={{fontSize:28,fontWeight:800,color:G,fontFamily:"'Syne',sans-serif",letterSpacing:2}}>ÁRIACRED</div>
          <div style={{fontSize:12,color:"#444",letterSpacing:3,marginTop:4}}>SOLUÇÕES FINANCEIRAS</div>
        </div>
        <div style={css.card}>
          <div style={{fontSize:16,fontWeight:700,color:"#fff",marginBottom:20}}>
            {mode==="login"?"Entrar na sua conta":"Criar conta"}
          </div>
          {mode==="register"&&<>
            <label style={css.lbl}>Seu nome</label>
            <input style={{...css.inp,marginBottom:12}} value={name} onChange={e=>setName(e.target.value)} placeholder="Nome completo"/>
          </>}
          <label style={css.lbl}>E-mail</label>
          <input style={{...css.inp,marginBottom:12}} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"/>
          <label style={css.lbl}>Senha</label>
          <input style={{...css.inp,marginBottom:err?8:16}} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handle()}/>
          {err&&<div style={{color:RD,fontSize:12,marginBottom:12,padding:"8px 12px",background:RD+"11",borderRadius:8}}>{err}</div>}
          <button style={{...css.btn(G,true),width:"100%",padding:14,fontSize:14}} onClick={handle} disabled={load}>
            {load?"Aguarde…":mode==="login"?"Entrar":"Criar conta"}
          </button>
          <div style={{textAlign:"center",marginTop:14,fontSize:12,color:"#555"}}>
            {mode==="login"?"Não tem conta? ":"Já tem conta? "}
            <span style={{color:G,cursor:"pointer",fontWeight:700}} onClick={()=>{setMode(mode==="login"?"register":"login");setErr("");}}>
              {mode==="login"?"Criar conta":"Entrar"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── GRÁFICO META ─────────────────────────────────────────────
function GraficoMeta({base}) {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const mi = new Date().getMonth();
  const pts = []; let c=base;
  for(let i=0;i<12;i++){c=c+(c*0.28)+1000;pts.push({mes:meses[(mi+i+1)%12],val:Math.round(c)});}
  const meta=1e6, maxV=Math.max(meta,pts[pts.length-1].val);
  const W=460,H=110,P=28;
  const xs=i=>P+i*(W-P*2)/(pts.length-1);
  const ys=v=>H-P-((v/maxV)*(H-P*2));
  const path=pts.map((p,i)=>`${i===0?"M":"L"}${xs(i)},${ys(p.val)}`).join(" ");
  const metaY=ys(meta);
  const hitIdx=pts.findIndex(p=>p.val>=meta);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:H,display:"block"}}>
      <defs>
        <linearGradient id="gl" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={G}/>
          <stop offset="100%" stopColor={GR}/>
        </linearGradient>
      </defs>
      <line x1={P} y1={metaY} x2={W-P} y2={metaY} stroke={G} strokeWidth={1} strokeDasharray="5 4" opacity={.4}/>
      <text x={W-P+2} y={metaY+4} fontSize={8} fill={G} opacity={.6}>R$1M</text>
      <path d={path} fill="none" stroke="url(#gl)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
      {pts.map((p,i)=>(
        <g key={i}>
          <circle cx={xs(i)} cy={ys(p.val)} r={i===hitIdx?5:2.5} fill={i===hitIdx?G:p.val>=meta?GR:BL} opacity={.9}/>
          <text x={xs(i)} y={H-3} fontSize={7} fill="#444" textAnchor="middle">{p.mes}</text>
          {i===hitIdx&&<text x={xs(i)} y={ys(p.val)-9} fontSize={9} textAnchor="middle" fill={G}>🎯</text>}
        </g>
      ))}
    </svg>
  );
}

// ─── CALCULADORA ──────────────────────────────────────────────
function Calculadora() {
  const [cap,setCap]=useState("");
  const [tipo,setTipo]=useState("normal");
  const [np,setNp]=useState("3");
  const capital=parseFloat(cap)||0;
  const taxa=tipo==="normal"?0.30:0.35;
  const juros=capital*taxa;
  const total=capital+juros;
  const parcV=tipo==="parcelado"&&parseInt(np)>0?(capital*(1+taxa))/parseInt(np):0;
  return (
    <div style={css.card}>
      <div style={{fontSize:13,fontWeight:700,color:G,marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>Calculadora de Juros</div>
      <div style={css.row}>
        <div style={css.col}>
          <label style={css.lbl}>Valor (R$)</label>
          <input style={{...css.inp,marginBottom:0}} type="number" value={cap} onChange={e=>setCap(e.target.value)} placeholder="0,00"/>
        </div>
        <div style={css.col}>
          <label style={css.lbl}>Modalidade</label>
          <select style={{...css.inp,marginBottom:0}} value={tipo} onChange={e=>setTipo(e.target.value)}>
            <option value="normal">Normal 30%</option>
            <option value="parcelado">Parcelado 35%</option>
          </select>
        </div>
        {tipo==="parcelado"&&<div style={css.col}>
          <label style={css.lbl}>Parcelas</label>
          <input style={{...css.inp,marginBottom:0}} type="number" value={np} onChange={e=>setNp(e.target.value)} placeholder="3"/>
        </div>}
      </div>
      {capital>0&&<div style={{background:BG,borderRadius:12,padding:16,marginTop:14,border:`1px solid ${G}22`,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:12}}>
        <div><div style={{fontSize:10,color:"#555"}}>Capital</div><div style={{fontSize:16,fontWeight:800,color:"#fff"}}>{fmt(capital)}</div></div>
        <div><div style={{fontSize:10,color:"#555"}}>Taxa</div><div style={{fontSize:16,fontWeight:800,color:G}}>{tipo==="normal"?"30%":"35%"}/mês</div></div>
        {tipo==="normal"&&<>
          <div><div style={{fontSize:10,color:"#555"}}>Juros/mês</div><div style={{fontSize:16,fontWeight:800,color:GR}}>{fmt(juros)}</div></div>
          <div><div style={{fontSize:10,color:"#555"}}>Quitação</div><div style={{fontSize:16,fontWeight:800,color:RD}}>{fmt(total)}</div></div>
        </>}
        {tipo==="parcelado"&&parseInt(np)>0&&<>
          <div><div style={{fontSize:10,color:"#555"}}>Por parcela</div><div style={{fontSize:16,fontWeight:800,color:GR}}>{fmt(parcV)}</div></div>
          <div><div style={{fontSize:10,color:"#555"}}>Total {np}x</div><div style={{fontSize:16,fontWeight:800,color:RD}}>{fmt(parcV*parseInt(np))}</div></div>
        </>}
      </div>}
    </div>
  );
}

// ─── CONTRATO TEXT ────────────────────────────────────────────
function textoContrato(c) {
  const taxa=c.tipo==="normal"?30:35;
  const juros=c.tipo==="normal"?c.capital*0.30:c.parcelaValor;
  const quit=c.tipo==="normal"?c.capital+juros:(c.parcelaValor*(c.parcelas-(c.parcelasPagas||0)));
  return `CONTRATO DE EMPRÉSTIMO PESSOAL
ÁRIACRED — SOLUÇÕES FINANCEIRAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREDOR: Áriacred Soluções Financeiras

DEVEDOR: ${c.nome}
CPF: ${c.cpf||"___.___.___-__"}
Endereço: ${c.endereco||"________________________________"}
Telefone: ${c.telefone||"(__) _____-____"}${c.indicadoPor?"\nIndicado por: "+c.indicadoPor:""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONDIÇÕES DO EMPRÉSTIMO

Modalidade: ${c.tipo==="normal"?"Normal — Juros Mensais (30%)":"Parcelado (35%)"}
Valor Emprestado: ${fmt(c.capital)}
Taxa de Juros: ${taxa}% ao mês
${c.tipo==="normal"?`Juros Mensais: ${fmt(juros)}\nDia de Vencimento: Todo dia ${c.venc}\nTotal para Quitação: ${fmt(quit)}`:`Parcelas: ${c.parcelas}x de ${fmt(c.parcelaValor)}\nDia de Vencimento: Todo dia ${c.venc}\nValor Total: ${fmt(c.parcelaValor*c.parcelas)}`}
Data de Início: ${c.dataInicio||hoje()}${c.obs?"\nObservações: "+c.obs:""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CLÁUSULAS

1. O DEVEDOR compromete-se a pagar pontualmente no dia ${c.venc} de cada mês.
2. Em caso de atraso, incidirá multa adicional acordada entre as partes.
3. O DEVEDOR autoriza a cobrança junto ao indicador em caso de inadimplência.
4. Este contrato é válido como título de dívida.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Data: ${hoje()}

Credor: _________________________________
        Áriacred Soluções Financeiras

Devedor: ________________________________
         ${c.nome}

Testemunha: _____________________________`;
}

// ─── MODAL CONTRATO ───────────────────────────────────────────
function ModalContrato({c,onClose}) {
  const txt=textoContrato(c);
  return (
    <div style={css.modal} onClick={onClose}>
      <div style={{...css.sheet,maxWidth:640}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:800,color:G}}>Contrato — {c.nome}</div>
          <div style={{display:"flex",gap:8}}>
            <button style={css.btnSm(G,true)} onClick={()=>navigator.clipboard.writeText(txt).then(()=>alert("Copiado!"))}>Copiar</button>
            <button style={css.btnSm(S3)} onClick={onClose}>✕</button>
          </div>
        </div>
        <pre style={{background:BG,borderRadius:12,padding:16,fontSize:11,color:"#bbb",whiteSpace:"pre-wrap",lineHeight:1.9,border:`1px solid ${G}22`,fontFamily:"'Courier New',monospace"}}>{txt}</pre>
      </div>
    </div>
  );
}

// ─── MODAL EDITAR ─────────────────────────────────────────────
function ModalEditar({c,onSave,onClose}) {
  const [f,setF]=useState({...c});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  return (
    <div style={css.modal} onClick={onClose}>
      <div style={css.sheet} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:800,color:G}}>Editar Contrato</div>
          <button style={css.btnSm(S3)} onClick={onClose}>✕</button>
        </div>
        <div style={css.row}>
          <div style={css.col}><label style={css.lbl}>Nome</label><input style={css.inp} value={f.nome} onChange={e=>set("nome",e.target.value)}/></div>
          <div style={css.col}><label style={css.lbl}>CPF</label><input style={css.inp} value={f.cpf||""} onChange={e=>set("cpf",e.target.value)} placeholder="000.000.000-00"/></div>
        </div>
        <div style={css.row}>
          <div style={css.col}><label style={css.lbl}>Telefone</label><input style={css.inp} value={f.telefone||""} onChange={e=>set("telefone",e.target.value)}/></div>
          <div style={css.col}><label style={css.lbl}>Indicado por</label><input style={css.inp} value={f.indicadoPor||""} onChange={e=>set("indicadoPor",e.target.value)}/></div>
        </div>
        <label style={css.lbl}>Endereço</label><input style={css.inp} value={f.endereco||""} onChange={e=>set("endereco",e.target.value)}/>
        <div style={css.row}>
          <div style={css.col}><label style={css.lbl}>Modalidade</label>
            <select style={css.inp} value={f.tipo} onChange={e=>set("tipo",e.target.value)}>
              <option value="normal">Normal 30%</option>
              <option value="parcelado">Parcelado 35%</option>
            </select>
          </div>
          <div style={css.col}><label style={css.lbl}>Capital (R$)</label><input style={css.inp} type="number" value={f.capital} onChange={e=>set("capital",parseFloat(e.target.value)||0)}/></div>
        </div>
        <div style={css.row}>
          <div style={css.col}><label style={css.lbl}>Dia Vencimento</label><input style={css.inp} type="number" value={f.venc} onChange={e=>set("venc",parseInt(e.target.value)||1)}/></div>
          <div style={css.col}><label style={css.lbl}>Data Início</label><input style={css.inp} value={f.dataInicio||""} onChange={e=>set("dataInicio",e.target.value)} placeholder="DD/MM/AAAA"/></div>
        </div>
        {f.tipo==="parcelado"&&<div style={css.row}>
          <div style={css.col}><label style={css.lbl}>Nº Parcelas</label><input style={css.inp} type="number" value={f.parcelas||0} onChange={e=>set("parcelas",parseInt(e.target.value)||0)}/></div>
          <div style={css.col}><label style={css.lbl}>Valor Parcela</label><input style={css.inp} type="number" value={f.parcelaValor||0} onChange={e=>set("parcelaValor",parseFloat(e.target.value)||0)}/></div>
          <div style={css.col}><label style={css.lbl}>Parcelas Pagas</label><input style={css.inp} type="number" value={f.parcelasPagas||0} onChange={e=>set("parcelasPagas",parseInt(e.target.value)||0)}/></div>
        </div>}
        <label style={css.lbl}>Observações</label><input style={css.inp} value={f.obs||""} onChange={e=>set("obs",e.target.value)} placeholder="Notas"/>
        <label style={css.lbl}>Status</label>
        <select style={css.inp} value={f.status} onChange={e=>set("status",e.target.value)}>
          <option value="ativo">Ativo</option>
          <option value="inadimplente">Inadimplente</option>
          <option value="quitado">Quitado</option>
        </select>
        <div style={{display:"flex",gap:10,marginTop:8}}>
          <button style={{...css.btnO("#555"),flex:1}} onClick={onClose}>Cancelar</button>
          <button style={{...css.btn(G,true),flex:2}} onClick={()=>onSave(f)}>Salvar Alterações</button>
        </div>
      </div>
    </div>
  );
}

// ─── CHECKLIST ────────────────────────────────────────────────
const CHECKS=["Tem indicação de alguém da carteira?","Tem documento (RG/CPF/comprovante)?","Endereço estável há mais de 6 meses?","Tem renda comprovada ou aparente?","Tom calmo? Sem urgência extrema?","Valor compatível com a renda?"];

// ─── NOVO CLIENTE FORM ────────────────────────────────────────
function NovoClienteForm({clientes,onAdd}) {
  const vazio={nome:"",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:"",venc:"",indicadoPor:"",parcelas:"",parcelaValor:"",dataInicio:"",obs:""};
  const [f,setF]=useState(vazio);
  const [checks,setChecks]=useState(Array(CHECKS.length).fill(false));
  const [sugestoes,setSugestoes]=useState([]);
  const [preview,setPreview]=useState(null);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const onNome=v=>{
    set("nome",v);
    if(v.length>=2) setSugestoes(clientes.filter(c=>c.nome.toLowerCase().includes(v.toLowerCase())).slice(0,4));
    else setSugestoes([]);
  };

  const handleAdd=async()=>{
    if(!f.nome||!f.capital){alert("Preencha nome e capital.");return;}
    await onAdd({...f,capital:parseFloat(f.capital),venc:parseInt(f.venc)||1,status:"ativo",parcelas:parseInt(f.parcelas)||0,parcelaValor:parseFloat(f.parcelaValor)||0,parcelasPagas:0});
    setF(vazio);setChecks(Array(CHECKS.length).fill(false));
    alert("Cliente cadastrado com sucesso!");
  };

  return (
    <div>
      <div style={css.card}>
        <div style={{fontSize:11,fontWeight:700,color:G,marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>Dados do Cliente</div>
        <div style={{position:"relative"}}>
          <label style={css.lbl}>Nome *</label>
          <input style={css.inp} value={f.nome} onChange={e=>onNome(e.target.value)} placeholder="Nome completo"/>
          {sugestoes.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:S2,border:"1px solid #222",borderRadius:10,zIndex:50,overflow:"hidden"}}>
            {sugestoes.map(c=><div key={c.id} onClick={()=>{setF(p=>({...p,nome:c.nome,cpf:c.cpf||"",telefone:c.telefone||"",endereco:c.endereco||"",indicadoPor:c.indicadoPor||""}));setSugestoes([]);}} style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid #1a1a1a",fontSize:12}}>
              <span style={{color:G}}>{c.nome}</span> <span style={{color:"#555"}}>— já cliente</span>
            </div>)}
          </div>}
        </div>
        <div style={css.row}>
          <div style={css.col}><label style={css.lbl}>CPF</label><input style={css.inp} value={f.cpf} onChange={e=>set("cpf",e.target.value)} placeholder="000.000.000-00"/></div>
          <div style={css.col}><label style={css.lbl}>Telefone</label><input style={css.inp} value={f.telefone} onChange={e=>set("telefone",e.target.value)} placeholder="(22) 99999-9999"/></div>
        </div>
        <label style={css.lbl}>Endereço</label><input style={css.inp} value={f.endereco} onChange={e=>set("endereco",e.target.value)} placeholder="Rua, nº, bairro"/>
        <label style={css.lbl}>Indicado por</label><input style={css.inp} value={f.indicadoPor} onChange={e=>set("indicadoPor",e.target.value)}/>
      </div>
      <div style={css.card}>
        <div style={{fontSize:11,fontWeight:700,color:G,marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>Condições do Empréstimo</div>
        <label style={css.lbl}>Modalidade</label>
        <select style={css.inp} value={f.tipo} onChange={e=>set("tipo",e.target.value)}>
          <option value="normal">Normal — 30%/mês (juros mensais)</option>
          <option value="parcelado">Parcelado — 35%/mês (parcela fixa)</option>
        </select>
        <div style={css.row}>
          <div style={css.col}><label style={css.lbl}>Valor (R$) *</label><input style={css.inp} type="number" value={f.capital} onChange={e=>set("capital",e.target.value)} placeholder="Ex: 500"/></div>
          <div style={css.col}><label style={css.lbl}>Dia Vencimento</label><input style={css.inp} type="number" value={f.venc} onChange={e=>set("venc",e.target.value)} placeholder="Ex: 10"/></div>
        </div>
        {f.tipo==="parcelado"&&<div style={css.row}>
          <div style={css.col}><label style={css.lbl}>Nº Parcelas</label><input style={css.inp} type="number" value={f.parcelas} onChange={e=>set("parcelas",e.target.value)}/></div>
          <div style={css.col}><label style={css.lbl}>Valor Parcela</label><input style={css.inp} type="number" value={f.parcelaValor} onChange={e=>set("parcelaValor",e.target.value)}/></div>
        </div>}
        <div style={css.row}>
          <div style={css.col}><label style={css.lbl}>Data Início</label><input style={css.inp} value={f.dataInicio} onChange={e=>set("dataInicio",e.target.value)} placeholder="DD/MM/AAAA"/></div>
          <div style={css.col}><label style={css.lbl}>Observações</label><input style={css.inp} value={f.obs} onChange={e=>set("obs",e.target.value)}/></div>
        </div>
      </div>
      <div style={css.card}>
        <div style={{fontSize:11,fontWeight:700,color:G,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>Checklist de Análise</div>
        {CHECKS.map((item,i)=>(
          <div key={i} onClick={()=>setChecks(p=>p.map((v,j)=>j===i?!v:v))} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:"1px solid #111",cursor:"pointer"}}>
            <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checks[i]?GR:"#333"}`,background:checks[i]?GR:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .2s"}}>
              {checks[i]&&<span style={{fontSize:11,color:"#000",fontWeight:800}}>✓</span>}
            </div>
            <div style={{fontSize:12,color:checks[i]?"#444":"#ccc",textDecoration:checks[i]?"line-through":"none"}}>{item}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,marginBottom:20}}>
        <button style={{...css.btnO(BL),flex:1}} onClick={()=>{
          if(!f.nome||!f.capital){alert("Preencha nome e capital.");return;}
          setPreview({...f,id:"prev",capital:parseFloat(f.capital)||0,venc:parseInt(f.venc)||1,parcelas:parseInt(f.parcelas)||0,parcelaValor:parseFloat(f.parcelaValor)||0,parcelasPagas:0,status:"ativo"});
        }}>Ver Contrato</button>
        <button style={{...css.btn(G,true),flex:2}} onClick={handleAdd}>Cadastrar Cliente</button>
      </div>
      {preview&&<ModalContrato c={preview} onClose={()=>setPreview(null)}/>}
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────
export default function App() {
  const [user,setUser]=useState(undefined);
  const [clientes,setClientes]=useState([]);
  const [tab,setTab]=useState(0);
  const [editModal,setEditModal]=useState(null);
  const [contratoModal,setContratoModal]=useState(null);
  const [msgModal,setMsgModal]=useState(null);

  useEffect(()=>{
    return onAuthStateChanged(auth,u=>setUser(u||null));
  },[]);

  useEffect(()=>{
    if(!user) return;
    const q=query(collection(db,"clientes"),orderBy("criadoEm","asc"));
    return onSnapshot(q,snap=>{
      setClientes(snap.docs.map(d=>({id:d.id,...d.data()})));
    },()=>{});
  },[user]);

  if(user===undefined) return (
    <div style={{...css.app,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <div style={{fontSize:24,fontWeight:800,color:G,fontFamily:"'Syne',sans-serif"}}>ÁRIACRED</div>
    </div>
  );
  if(!user) return <Login/>;

  const ativos=clientes.filter(c=>c.status==="ativo");
  const inad=clientes.filter(c=>c.status==="inadimplente");
  const cN=ativos.filter(c=>c.tipo==="normal").reduce((s,c)=>s+(c.capital||0),0);
  const cP=ativos.filter(c=>c.tipo==="parcelado").reduce((s,c)=>s+(c.capital||0),0);
  const jN=cN*0.30;
  const jP=ativos.filter(c=>c.tipo==="parcelado").reduce((s,c)=>s+(c.parcelaValor||0),0);
  const base=cN+cP||0;
  const totJ=jN+jP;
  const pct=Math.min((base/1e6)*100,100);
  const dia=diaHoje();
  const cobrarHoje=clientes.filter(c=>(c.status==="ativo"&&c.venc===dia)||c.status==="inadimplente").length;

  const addCliente=async(novo)=>{
    await addDoc(collection(db,"clientes"),{...novo,criadoPor:user.uid,criadoEm:new Date().toISOString()});
  };
  const updCliente=async(id,data)=>{ await updateDoc(doc(db,"clientes",id),data); };
  const delCliente=async(id)=>{ if(window.confirm("Excluir este cliente?")) await deleteDoc(doc(db,"clientes",id)); };

  const gerarMsg=(c,atrasado)=>{
    const s=saud(), n=c.nome.split(" ")[0];
    const j=c.tipo==="normal"?fmt(c.capital*0.30):fmt(c.parcelaValor);
    const q=c.tipo==="normal"?fmt(c.capital+c.capital*0.30):fmt(c.parcelaValor*(c.parcelas-(c.parcelasPagas||0)));
    if(atrasado) return `${s}, ${n}!\n\nPassando para informar que identificamos seu pagamento em aberto com a Áriacred.\n\nValor dos juros: ${j}\nValor para quitação total: ${q}${c.indicadoPor?"\n\nSeu contrato tem a indicação de "+c.indicadoPor+", que será comunicado sobre a situação.":""}\n\nEntre em contato para regularizarmos.\n\nÁriacred Soluções Financeiras`;
    return `${s}, ${n}!\n\nPassando para lembrar que hoje, dia ${dia}, é o vencimento do seu contrato.\n\nValor dos juros do mês: ${j}\nValor para quitação total: ${q}\n\nAssim que fizer o pagamento nos envie o comprovante.\n\nÁriacred Soluções Financeiras`;
  };

  const exportarCSV=()=>{
    const h=["Nome","CPF","Telefone","Tipo","Capital","Taxa","Juros/Mês","Parcelas","Pagas","Vencimento","Status","Indicado Por","Data Início","Obs"];
    const rows=clientes.map(c=>[c.nome,c.cpf||"",c.telefone||"",c.tipo==="normal"?"Normal 30%":"Parcelado 35%",c.capital,c.tipo==="normal"?"30%":"35%",c.tipo==="normal"?(c.capital*0.30).toFixed(2):c.parcelaValor||0,c.parcelas||0,c.parcelasPagas||0,c.venc,c.status,c.indicadoPor||"",c.dataInicio||"",(c.obs||"").replace(/,/g,";")]);
    const csv=[h,...rows].map(r=>r.join(",")).join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
    a.download=`ariacred-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const TABS=["Dashboard","Contratos","Cobrança","Novo Cliente","Calculadora","Relatório"];

  return (
    <div style={css.app}>
      {/* ── TOP BAR */}
      <div style={{background:S1,borderBottom:"1px solid #1a1a1a",padding:"12px 20px",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:38,height:38,borderRadius:8,background:G,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800,color:"#000",fontFamily:"'Syne',sans-serif"}}>A</div>
            <div>
              <div style={{fontSize:17,fontWeight:800,color:G,fontFamily:"'Syne',sans-serif",letterSpacing:1}}>ÁRIACRED</div>
              <div style={{fontSize:9,color:"#444",letterSpacing:2}}>SOLUÇÕES FINANCEIRAS</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:16}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:13,fontWeight:700,color:GR}}>{fmtK(base)}</div>
              <div style={{fontSize:10,color:"#555"}}>{saud()}, {nomeDisplay(user)}</div>
            </div>
            <button style={{...css.btnSm(S3),fontSize:11,color:"#666"}} onClick={()=>signOut(auth)}>Sair</button>
          </div>
        </div>
      </div>

      {/* ── TABS — CORREÇÃO: usando css.tabStyle(active) em vez de css.tab?.[i]:{} */}
      <div style={{background:S1,borderBottom:"1px solid #1a1a1a",position:"sticky",top:62,zIndex:99,overflowX:"auto"}}>
        <div style={{maxWidth:900,margin:"0 auto",display:"flex"}}>
          {TABS.map((t,i)=>(
            <button key={t} onClick={()=>setTab(i)} style={css.tabStyle(tab===i)}>
              {t}
              {i===2&&cobrarHoje>0&&<span style={{position:"absolute",top:6,right:4,background:RD,color:"#fff",borderRadius:10,fontSize:8,padding:"1px 5px",fontWeight:800}}>{cobrarHoje}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTEÚDO */}
      <div style={{...css.wrap,padding:"16px 16px 80px"}}>

        {/* DASHBOARD */}
        {tab===0&&<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:16}}>
            {[
              {label:"Capital",val:fmtK(base),cor:GR},
              {label:"Juros/Mês",val:fmtK(totJ),cor:G},
              {label:"Ativos",val:ativos.length,cor:BL},
              {label:"Inadimplentes",val:inad.length,cor:inad.length>0?RD:"#444"},
            ].map(({label,val,cor})=>(
              <div key={label} style={{background:S2,borderRadius:14,padding:"14px 16px",border:`1px solid ${cor}22`,textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:800,color:cor}}>{val}</div>
                <div style={{fontSize:10,color:"#555",marginTop:2}}>{label}</div>
              </div>
            ))}
          </div>

          {inad.length>0&&<div style={{background:"#1a0505",border:`1px solid ${RD}33`,borderRadius:12,padding:"12px 16px",marginBottom:16,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}} onClick={()=>setTab(2)}>
            <div><div style={{fontSize:13,fontWeight:700,color:RD}}>{inad.length} inadimplente{inad.length>1?"s":""}</div><div style={{fontSize:11,color:"#555"}}>Toque para ver cobranças</div></div>
            <span style={{color:RD,fontSize:18}}>→</span>
          </div>}

          <div style={css.cardG}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:700,color:G}}>Meta: R$ 1.000.000</div>
              <div style={{fontSize:13,fontWeight:800,color:G}}>{pct.toFixed(1)}%</div>
            </div>
            <div style={{height:6,borderRadius:3,background:"#1a1a1a",marginBottom:8}}>
              <div style={{height:"100%",width:pct+"%",background:`linear-gradient(90deg,${G},${GR})`,borderRadius:3,transition:"width .6s"}}/>
            </div>
            <div style={{fontSize:11,color:"#555",marginBottom:14}}>Faltam <span style={{color:G,fontWeight:700}}>{fmtK(1e6-base)}</span></div>
            <GraficoMeta base={base}/>
          </div>

          <div style={css.card}>
            <div style={{fontSize:11,fontWeight:700,color:G,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>Modalidades</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{background:BG,borderRadius:12,padding:"12px 14px",border:`1px solid ${BL}22`}}>
                <div style={{fontSize:10,color:"#555",marginBottom:4}}>Normal 30%</div>
                <div style={{fontSize:16,fontWeight:800,color:BL}}>{fmtK(cN)}</div>
                <div style={{fontSize:11,color:GR}}>+{fmtK(jN)}/mês</div>
              </div>
              <div style={{background:BG,borderRadius:12,padding:"12px 14px",border:`1px solid ${PU}22`}}>
                <div style={{fontSize:10,color:"#555",marginBottom:4}}>Parcelado 35%</div>
                <div style={{fontSize:16,fontWeight:800,color:PU}}>{fmtK(cP)}</div>
                <div style={{fontSize:11,color:GR}}>+{fmtK(jP)}/mês</div>
              </div>
            </div>
          </div>
        </>}

        {/* CONTRATOS */}
        {tab===1&&<>
          <input style={{...css.inp,marginBottom:14}} placeholder="Buscar cliente..." onChange={e=>{
            const v=e.target.value.toLowerCase();
            document.querySelectorAll("[data-nome]").forEach(el=>{
              el.style.display=el.dataset.nome.includes(v)?"":"none";
            });
          }}/>
          {clientes.filter(c=>c.status!=="quitado").length===0&&<div style={{...css.card,textAlign:"center",color:"#555",padding:30}}>Nenhum contrato ativo.</div>}
          {clientes.filter(c=>c.status!=="quitado").map(c=>(
            <div key={c.id} data-nome={c.nome.toLowerCase()} style={{background:c.status==="inadimplente"?"#1a0505":S2,borderRadius:14,padding:16,marginBottom:12,border:`1px solid ${c.status==="inadimplente"?RD+"33":"#1c1c1c"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <div style={{fontSize:14,fontWeight:700,color:c.status==="inadimplente"?RD:"#fff"}}>{c.nome}</div>
                  <div style={{fontSize:11,color:"#555",marginTop:2}}>
                    {c.tipo==="normal"?"Normal 30%":"Parcelado 35%"} · Dia {c.venc}
                    {c.indicadoPor&&<span style={{color:"#444"}}> · Ind: {c.indicadoPor}</span>}
                  </div>
                </div>
                <span style={css.badge(c.status==="ativo"?GR:c.status==="inadimplente"?RD:"#555")}>
                  {c.status==="ativo"?"Ativo":c.status==="inadimplente"?"Inadim.":"Quitado"}
                </span>
              </div>
              <div style={{display:"flex",gap:16,marginBottom:12}}>
                <div><div style={{fontSize:10,color:"#555"}}>Capital</div><div style={{fontSize:14,fontWeight:700,color:G}}>{fmt(c.capital)}</div></div>
                {c.tipo==="normal"&&<div><div style={{fontSize:10,color:"#555"}}>Juros/mês</div><div style={{fontSize:14,fontWeight:700,color:GR}}>{fmt(c.capital*0.30)}</div></div>}
                {c.tipo==="parcelado"&&<>
                  <div><div style={{fontSize:10,color:"#555"}}>Parcela</div><div style={{fontSize:14,fontWeight:700,color:GR}}>{fmt(c.parcelaValor)}</div></div>
                  <div><div style={{fontSize:10,color:"#555"}}>Pagas</div><div style={{fontSize:14,fontWeight:700}}>{c.parcelasPagas||0}/{c.parcelas}</div></div>
                </>}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button style={css.btnSm(G,true)} onClick={()=>setEditModal(c)}>Editar</button>
                <button style={css.btnSm(BL)} onClick={()=>setContratoModal(c)}>Contrato</button>
                {c.tipo==="parcelado"&&(c.parcelasPagas||0)<c.parcelas&&(
                  <button style={css.btnSm(GR)} onClick={()=>updCliente(c.id,{parcelasPagas:(c.parcelasPagas||0)+1,status:(c.parcelasPagas||0)+1>=c.parcelas?"quitado":c.status})}>+Parcela Paga</button>
                )}
                <button style={css.btnSm(RD)} onClick={()=>delCliente(c.id)}>Excluir</button>
              </div>
            </div>
          ))}
        </>}

        {/* COBRANÇA */}
        {tab===2&&<>
          {clientes.filter(c=>(c.status==="ativo"&&c.venc===dia)||c.status==="inadimplente").length===0&&(
            <div style={{...css.card,textAlign:"center",padding:32}}>
              <div style={{fontSize:32,color:GR,marginBottom:8}}>✓</div>
              <div style={{fontSize:14,color:GR,fontWeight:700}}>Sem cobranças hoje</div>
              <div style={{fontSize:11,color:"#555",marginTop:4}}>Dia atual: {dia}</div>
            </div>
          )}
          {[
            {titulo:`Vencem Hoje — Dia ${dia}`,lista:clientes.filter(c=>c.status==="ativo"&&c.venc===dia),atrasado:false,cor:G},
            {titulo:`Inadimplentes (${inad.length})`,lista:inad,atrasado:true,cor:RD},
            {titulo:"Vencem em Breve",lista:clientes.filter(c=>c.status==="ativo"&&(c.venc===dia+1||c.venc===dia+2)),atrasado:false,cor:"#555"},
          ].map(({titulo,lista,atrasado,cor})=>lista.length>0&&(
            <div key={titulo} style={css.card}>
              <div style={{fontSize:11,fontWeight:700,color:cor,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>{titulo}</div>
              {lista.map(c=>(
                <div key={c.id} style={{background:BG,borderRadius:12,padding:"12px 14px",marginBottom:10,border:`1px solid ${atrasado?RD+"22":"#1c1c1c"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:atrasado?RD:G}}>{c.nome}</div>
                      <div style={{fontSize:11,color:"#555"}}>{c.tipo==="normal"?`Juros: ${fmt(c.capital*0.30)}`:`Parcela: ${fmt(c.parcelaValor)}`} · Dia {c.venc}</div>
                    </div>
                    <button style={css.btnSm(atrasado?RD:G,!atrasado)} onClick={()=>setMsgModal({c,atrasado})}>Mensagem</button>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button style={{...css.btnSm(GR),fontSize:11}} onClick={()=>{
                      if(c.tipo==="parcelado"){const n=(c.parcelasPagas||0)+1;updCliente(c.id,{parcelasPagas:n,status:n>=c.parcelas?"quitado":"ativo"});}
                      else{updCliente(c.id,{status:"ativo"});}
                    }}>✓ Pago</button>
                    {!atrasado&&<button style={{...css.btnSm(RD),fontSize:11}} onClick={()=>updCliente(c.id,{status:"inadimplente"})}>Inadimplente</button>}
                    {atrasado&&<button style={{...css.btnSm(GR),fontSize:11}} onClick={()=>updCliente(c.id,{status:"ativo"})}>Regularizado</button>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>}

        {/* NOVO CLIENTE */}
        {tab===3&&<NovoClienteForm clientes={clientes} onAdd={addCliente}/>}

        {/* CALCULADORA */}
        {tab===4&&<Calculadora/>}

        {/* RELATÓRIO */}
        {tab===5&&<>
          <div style={css.cardG}>
            <div style={{fontSize:11,fontWeight:700,color:G,marginBottom:14,textTransform:"uppercase",letterSpacing:1}}>Resumo da Carteira</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:16}}>
              {[
                ["Capital Total",fmt(base),GR],
                ["Juros/Mês",fmt(totJ),G],
                ["Ativos",ativos.length,BL],
                ["Inadimplentes",inad.length,inad.length>0?RD:"#444"],
                ["Quitados",clientes.filter(c=>c.status==="quitado").length,"#555"],
                ["Total Clientes",clientes.length,"#888"],
              ].map(([k,v,c])=>(
                <div key={k} style={{background:BG,borderRadius:10,padding:"12px 14px",border:`1px solid ${c}22`}}>
                  <div style={{fontSize:10,color:"#555"}}>{k}</div>
                  <div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              <button style={{...css.btn(GR),flex:1,minWidth:140}} onClick={exportarCSV}>Exportar Excel (CSV)</button>
              <button style={{...css.btn(BL),flex:1,minWidth:140}} onClick={()=>{
                const linhas=["ÁRIACRED — RELATÓRIO","Data: "+hoje(),"","RESUMO",`Capital: ${fmt(base)}`,`Juros/Mês: ${fmt(totJ)}`,`Ativos: ${ativos.length}`,`Inadimplentes: ${inad.length}`,"","CLIENTES ATIVOS",...ativos.map(c=>`${c.nome} | ${fmt(c.capital)} | Dia ${c.venc} | ${c.tipo==="normal"?fmt(c.capital*0.30)+"/mês":`${c.parcelasPagas||0}/${c.parcelas} parc`}`),"","INADIMPLENTES",...(inad.length?inad.map(c=>`${c.nome} | ${fmt(c.capital)}`):["Nenhum."])];
                const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([linhas.join("\n")],{type:"text/plain"}));a.download="ariacred-resumo.txt";a.click();
              }}>Exportar Resumo (TXT)</button>
            </div>
          </div>
          <div style={css.card}>
            <div style={{fontSize:11,fontWeight:700,color:G,marginBottom:12,textTransform:"uppercase",letterSpacing:1}}>Todos os Clientes</div>
            {clientes.map(c=>(
              <div key={c.id} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #111",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:c.status==="inadimplente"?RD:c.status==="quitado"?"#555":"#ccc"}}>{c.nome}</div>
                  <div style={{fontSize:10,color:"#444"}}>{c.tipo==="normal"?`Juros: ${fmt(c.capital*0.30)}/mês`:`${c.parcelasPagas||0}/${c.parcelas} parcelas`}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:13,fontWeight:700,color:G}}>{fmt(c.capital)}</div>
                  <span style={css.badge(c.status==="ativo"?GR:c.status==="inadimplente"?RD:"#555")}>{c.status}</span>
                </div>
              </div>
            ))}
          </div>
        </>}

      </div>

      {/* MODAIS */}
      {editModal&&<ModalEditar c={editModal} onSave={f=>{updCliente(f.id,f);setEditModal(null);}} onClose={()=>setEditModal(null)}/>}
      {contratoModal&&<ModalContrato c={contratoModal} onClose={()=>setContratoModal(null)}/>}
      {msgModal&&(
        <div style={css.modal} onClick={()=>setMsgModal(null)}>
          <div style={css.sheet} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
              <div style={{fontSize:14,fontWeight:800,color:G}}>Mensagem de Cobrança</div>
              <button style={css.btnSm(S3)} onClick={()=>setMsgModal(null)}>✕</button>
            </div>
            <div style={{fontSize:11,color:"#555",marginBottom:10}}>Para: {msgModal.c.nome}</div>
            <pre style={{background:BG,borderRadius:12,padding:16,fontSize:12,color:"#ccc",whiteSpace:"pre-wrap",lineHeight:1.9,border:`1px solid #1c1c1c`,fontFamily:"'DM Sans',sans-serif",marginBottom:14}}>{gerarMsg(msgModal.c,msgModal.atrasado)}</pre>
            <button style={{...css.btn(GR),width:"100%"}} onClick={()=>navigator.clipboard.writeText(gerarMsg(msgModal.c,msgModal.atrasado)).then(()=>{alert("Copiado!");setMsgModal(null);})}>
              Copiar para WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
