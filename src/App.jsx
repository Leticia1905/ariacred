import { useState, useEffect, useRef } from "react";
import { auth, db } from "./firebase.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile
} from "firebase/auth";
import {
  collection, addDoc, onSnapshot, updateDoc,
  doc, deleteDoc, query, orderBy, getDoc, setDoc
} from "firebase/firestore";

const LOGO = "/logo.png";

// -- CORES
const G="#C9A84C",BG="#000",S1="#0a0a0a",S2="#111",S3="#161616";
const GR="#22c55e",RD="#ef4444",BL="#3b82f6",PU="#a855f7";

// -- UTILS
const fmt = v => "R$ "+Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2});
const fmtK = v => {
  if(v>=1e6) return "R$ "+(v/1e6).toFixed(2)+"M";
  if(v>=1e3) return "R$ "+(v/1e3).toFixed(1)+"k";
  return "R$ "+Number(v||0).toFixed(0);
};
const hoje = () => new Date().toLocaleDateString("pt-BR");
const diaHoje = () => new Date().getDate();
const saud = () => { const h=new Date().getHours(); return h<12?"Bom dia":h<18?"Boa tarde":"Boa noite"; };
const nomeDisplay = u => u?.displayName||u?.email?.split("@")[0]||"Usuário";

// -- C-LCULO PARCELADO CORRETO
// capital + 35% + 35% + 30% = capital * (1 + 0.35 + 0.35 + 0.30) = capital * 2.0
// dividido pelo n-mero de parcelas
const calcParcelaValor = (capital, nparcelas) => {
  if (!capital || !nparcelas) return 0;
  // Cada m-s tem 35% de juros sobre o capital original
  // Total = capital + (capital - 35% - nparcelas)
  // Parcela = Total - nparcelas
  const totalJuros = capital * 0.35 * nparcelas;
  const total = capital + totalJuros;
  return total / nparcelas;
};

// -- SEMANA ATUAL
const getSemanaAtual = () => {
  const hoje = new Date();
  const diaSemana = hoje.getDay();
  const inicioDate = new Date(hoje);
  inicioDate.setDate(hoje.getDate() - diaSemana);
  inicioDate.setHours(0,0,0,0);
  const fimDate = new Date(inicioDate);
  fimDate.setDate(inicioDate.getDate() + 6);
  fimDate.setHours(23,59,59,999);
  // Gera array com {dia, mes} de cada dia da semana
  const diasSemana = [];
  for(let i=0;i<7;i++){
    const d = new Date(inicioDate);
    d.setDate(inicioDate.getDate()+i);
    diasSemana.push({ dia: d.getDate(), mes: d.getMonth() });
  }
  const label = `${inicioDate.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})} a ${fimDate.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})}`;
  // Para comparar com venc (dia do m-s), inclui todos os dias da semana
  const dias = diasSemana.map(d => d.dia);
  const mesAtual = hoje.getMonth();
  return { inicio: inicioDate.getDate(), fim: fimDate.getDate(), dias, diasSemana, label, mesAtual };
};

// Verifica se um cliente vence nessa semana considerando m-s
const venceNaSemana = (cliente, semana) => {
  if(cliente.status !== "ativo") return false;
  // Se a semana n-o cruza m-s, compara--o simples
  const mesmomes = semana.diasSemana.every(d => d.mes === semana.mesAtual);
  if(mesmomes) return semana.dias.includes(cliente.venc);
  // Semana cruza m-s: verifica se o dia do vencimento existe nessa semana
  return semana.diasSemana.some(d => d.dia === cliente.venc);
};

// -- ESTILOS
const css = {
  app: { background:BG, minHeight:"100vh", color:"#fff", fontFamily:"'DM Sans',sans-serif" },
  wrap: { maxWidth:920, margin:"0 auto", padding:"16px 16px 80px" },
  card: { background:S2, borderRadius:16, padding:20, marginBottom:16, border:"1px solid #1c1c1c" },
  cardG: { background:"linear-gradient(135deg,#0a0f0a,#0d0d0d)", borderRadius:16, padding:20, marginBottom:16, border:`1px solid ${G}33` },
  inp: { background:S1, border:"1px solid #222", borderRadius:10, padding:"12px 14px", color:"#fff", fontSize:14, width:"100%", outline:"none", fontFamily:"'DM Sans',sans-serif" },
  lbl: { fontSize:11, color:"#555", marginBottom:5, display:"block", letterSpacing:.5, textTransform:"uppercase" },
  btn: (c,dk=false) => ({ background:c, color:dk?"#000":"#fff", border:"none", borderRadius:10, padding:"12px 20px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" }),
  btnSm: (c,dk=false) => ({ background:c, color:dk?"#000":"#fff", border:"none", borderRadius:8, padding:"7px 13px", fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }),
  btnO: c => ({ background:"transparent", color:c, border:`1px solid ${c}44`, borderRadius:10, padding:"11px 18px", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" }),
  badge: c => ({ display:"inline-flex", alignItems:"center", background:c+"18", color:c, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }),
  modal: { position:"fixed", inset:0, background:"#000000ee", zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center" },
  sheet: { background:S1, borderRadius:"20px 20px 0 0", padding:24, width:"100%", maxWidth:640, maxHeight:"92vh", overflowY:"auto", border:"1px solid #1c1c1c" },
  row: { display:"flex", gap:12, flexWrap:"wrap" },
  col: { flex:1, minWidth:130 },
  st: { fontSize:11, fontWeight:700, color:G, marginBottom:12, textTransform:"uppercase", letterSpacing:1.5 },
};

// -- LOGIN
function Login() {
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [name,setName]=useState("");
  const [mode,setMode]=useState("login");
  const [err,setErr]=useState("");
  const [load,setLoad]=useState(false);
  const handle = async () => {
    if(!email||!pass){setErr("Preencha e-mail e senha.");return;}
    setLoad(true);setErr("");
    try {
      if(mode==="login"){
        await signInWithEmailAndPassword(auth,email,pass);
      } else {
        if(!name){setErr("Digite seu nome.");setLoad(false);return;}
        const cred=await createUserWithEmailAndPassword(auth,email,pass);
        await updateProfile(cred.user,{displayName:name});
      }
    } catch(e) {
      const m={"auth/wrong-password":"Senha incorreta.","auth/user-not-found":"E-mail não cadastrado.","auth/invalid-credential":"E-mail ou senha incorretos.","auth/email-already-in-use":"E-mail já cadastrado.","auth/weak-password":"Senha fraca - mínimo 6 caracteres."};
      setErr(m[e.code]||"Erro ao entrar.");
    }
    setLoad(false);
  };
  return (
    <div style={{...css.app,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:20}}>
      <div style={{width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <img src={LOGO} alt="Áriacred" style={{width:90,height:90,borderRadius:14,objectFit:"cover",marginBottom:14}}/>
          <div style={{fontSize:26,fontWeight:800,color:G,fontFamily:"'Syne',sans-serif",letterSpacing:2}}>ÁRIACRED</div>
          <div style={{fontSize:11,color:"#444",letterSpacing:3,marginTop:4}}>SOLUÇÕES FINANCEIRAS</div>
        </div>
        <div style={css.card}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:18}}>{mode==="login"?"Entrar na sua conta":"Criar conta"}</div>
          {mode==="register"&&<><label style={css.lbl}>Seu nome</label><input style={{...css.inp,marginBottom:12}} value={name} onChange={e=>setName(e.target.value)} placeholder="Nome completo"/></>}
          <label style={css.lbl}>E-mail</label>
          <input style={{...css.inp,marginBottom:12}} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"/>
          <label style={css.lbl}>Senha</label>
          <input style={{...css.inp,marginBottom:err?8:14}} type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&handle()}/>
          {err&&<div style={{color:RD,fontSize:12,marginBottom:12,padding:"8px 12px",background:RD+"11",borderRadius:8}}>{err}</div>}
          <button style={{...css.btn(G,true),width:"100%",padding:14,fontSize:14}} onClick={handle} disabled={load}>{load?"Aguarde…":mode==="login"?"Entrar":"Criar conta"}</button>
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

// -- GR-FICO
function GraficoMeta({base}) {
  const meses=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const mi=new Date().getMonth();
  const pts=[];let c=base;
  for(let i=0;i<12;i++){c=c+(c*0.28)+1000;pts.push({mes:meses[(mi+i+1)%12],val:Math.round(c)});}
  const meta=1e6,maxV=Math.max(meta,pts[pts.length-1].val);
  const W=460,H=110,P=28;
  const xs=i=>P+i*(W-P*2)/(pts.length-1);
  const ys=v=>H-P-((v/maxV)*(H-P*2));
  const path=pts.map((p,i)=>`${i===0?"M":"L"}${xs(i)},${ys(p.val)}`).join(" ");
  const metaY=ys(meta);
  const hitIdx=pts.findIndex(p=>p.val>=meta);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:H,display:"block"}}>
      <defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={G}/><stop offset="100%" stopColor={GR}/></linearGradient></defs>
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

// -- CALCULADORA
function Calculadora({inline=false}) {
  const [cap,setCap]=useState("");
  const [tipo,setTipo]=useState("normal");
  const [np,setNp]=useState("3");
  const capital=parseFloat(cap)||0;
  const npNum=parseInt(np)||1;
  const juros=capital*0.30;
  const totalNormal=capital+juros;
  const parcV=calcParcelaValor(capital,npNum);
  const totalParc=parcV*npNum;
  return (
    <div style={inline?{}:css.card}>
      {!inline&&<div style={css.st}>Calculadora de Juros</div>}
      <div style={css.row}>
        <div style={css.col}>
          <label style={css.lbl}>Valor (R$)</label>
          <input style={{...css.inp,marginBottom:0}} type="number" value={cap} onChange={e=>setCap(e.target.value)} placeholder="0,00"/>
        </div>
        <div style={css.col}>
          <label style={css.lbl}>Modalidade</label>
          <select style={{...css.inp,marginBottom:0}} value={tipo} onChange={e=>setTipo(e.target.value)}>
            <option value="normal">Normal (30%/mês)</option>
            <option value="parcelado">Parcelamento (35%/mês)</option>
          </select>
        </div>
        {tipo==="parcelado"&&<div style={css.col}>
          <label style={css.lbl}>Parcelas</label>
          <input style={{...css.inp,marginBottom:0}} type="number" value={np} onChange={e=>setNp(e.target.value)} placeholder="3"/>
        </div>}
      </div>
      {capital>0&&<div style={{background:BG,borderRadius:12,padding:16,marginTop:14,border:`1px solid ${G}22`,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:12}}>
        <div><div style={{fontSize:10,color:"#555"}}>Capital</div><div style={{fontSize:15,fontWeight:800,color:"#fff"}}>{fmt(capital)}</div></div>
        {tipo==="normal"&&<>
          <div><div style={{fontSize:10,color:"#555"}}>Juros/mês</div><div style={{fontSize:15,fontWeight:800,color:GR}}>{fmt(juros)}</div></div>
          <div><div style={{fontSize:10,color:"#555"}}>Quitação</div><div style={{fontSize:15,fontWeight:800,color:RD}}>{fmt(totalNormal)}</div></div>
        </>}
        {tipo==="parcelado"&&<>
          <div><div style={{fontSize:10,color:"#555"}}>Por parcela</div><div style={{fontSize:15,fontWeight:800,color:GR}}>{fmt(parcV)}</div></div>
          <div><div style={{fontSize:10,color:"#555"}}>Total {np}x</div><div style={{fontSize:15,fontWeight:800,color:RD}}>{fmt(totalParc)}</div></div>
          <div><div style={{fontSize:10,color:"#555"}}>Juros total</div><div style={{fontSize:15,fontWeight:800,color:G}}>{fmt(totalParc-capital)}</div></div>
        </>}
      </div>}
    </div>
  );
}

// -- TEXTO CONTRATO
function textoContrato(c) {
  const taxa=c.tipo==="normal"?"30%":"35%+35%+30%";
  const juros=c.tipo==="normal"?fmt(c.capital*0.30):fmt(c.parcelaValor);
  const quit=c.tipo==="normal"?fmt(c.capital+c.capital*0.30):fmt(c.parcelaValor*(c.parcelas-(c.parcelasPagas||0)));
  return `CONTRATO DE EMPRÉSTIMO PESSOAL
ÁRIACRED - SOLUÇÕES FINANCEIRAS
─────────────────────────────────

CREDOR: Áriacred Soluções Financeiras

DEVEDOR: ${c.nome}
CPF: ${c.cpf||"___.___.___-__"}
Endereço: ${c.endereco||"________________________________"}
Telefone: ${c.telefone||"(__) _____-____"}${c.indicadoPor?"\nIndicado por: "+c.indicadoPor:""}

─────────────────────────────────
CONDIÇÕES

Modalidade: ${c.tipo==="normal"?"Normal - Juros Mensais (30%)":"Parcelado (35%+35%+30%)"}
Valor Emprestado: ${fmt(c.capital)}
Taxa: ${taxa}
${c.tipo==="normal"?`Juros Mensais: ${juros}\nDia de Vencimento: Dia ${c.venc}\nTotal Quitação: ${quit}`:`Parcelas: ${c.parcelas}x de ${fmt(c.parcelaValor)}\nDia de Vencimento: Dia ${c.venc}\nTotal: ${fmt(c.parcelaValor*c.parcelas)}`}
Início: ${c.dataInicio||hoje()}${c.obs?"\nObs: "+c.obs:""}

─────────────────────────────────
CLÁUSULAS

1. Pagamento pontual no dia ${c.venc} de cada mês.
2. Atraso sujeito a multa acordada entre as partes.
3. Devedor autoriza cobrança junto ao indicador.
4. Este contrato é válido como título de dívida.

─────────────────────────────────
Data: ${hoje()}

Credor: _________________________________
        Áriacred Soluções Financeiras

Devedor: ________________________________
         ${c.nome}

Testemunha: _____________________________`;
}

// -- MODAL CONTRATO
function ModalContrato({c,onClose}) {
  const txt=textoContrato(c);
  return (
    <div style={css.modal} onClick={onClose}>
      <div style={{...css.sheet,maxWidth:640}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:800,color:G}}>Contrato - {c.nome}</div>
          <div style={{display:"flex",gap:8}}>
            <button style={css.btnSm(G,true)} onClick={()=>navigator.clipboard.writeText(txt).then(()=>alert("Copiado!"))}>Copiar</button>
            <button style={css.btnSm(S3)} onClick={onClose}>✕</button>
          </div>
        </div>
        <pre style={{background:BG,borderRadius:12,padding:16,fontSize:11,color:"#bbb",whiteSpace:"pre-wrap",lineHeight:1.9,border:`1px solid ${G}22`,fontFamily:"monospace"}}>{txt}</pre>
      </div>
    </div>
  );
}

// -- MODAL EDITAR
function ModalEditar({c,onSave,onClose}) {
  const [f,setF]=useState({...c});
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const atualizarParcela=()=>{
    if(f.tipo==="parcelado"&&f.capital&&f.parcelas){
      const pv=calcParcelaValor(parseFloat(f.capital),parseInt(f.parcelas));
      setF(p=>({...p,parcelaValor:Math.round(pv*100)/100}));
    }
  };
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
          <div style={css.col}>
            <label style={css.lbl}>Modalidade</label>
            <select style={css.inp} value={f.tipo} onChange={e=>set("tipo",e.target.value)}>
              <option value="normal">Normal (30%/mês)</option>
              <option value="parcelado">Parcelamento (35%/mês)</option>
            </select>
          </div>
          <div style={css.col}><label style={css.lbl}>Capital (R$)</label><input style={css.inp} type="number" value={f.capital} onChange={e=>set("capital",parseFloat(e.target.value)||0)} onBlur={atualizarParcela}/></div>
        </div>
        <div style={css.row}>
          <div style={css.col}><label style={css.lbl}>Dia Vencimento</label><input style={css.inp} type="number" value={f.venc} onChange={e=>set("venc",parseInt(e.target.value)||1)}/></div>
          <div style={css.col}><label style={css.lbl}>Data Início</label><input style={css.inp} value={f.dataInicio||""} onChange={e=>set("dataInicio",e.target.value)} placeholder="DD/MM/AAAA"/></div>
        </div>
        {f.tipo==="parcelado"&&<div style={css.row}>
          <div style={css.col}><label style={css.lbl}>Nº Parcelas</label><input style={css.inp} type="number" value={f.parcelas||0} onChange={e=>set("parcelas",parseInt(e.target.value)||0)} onBlur={atualizarParcela}/></div>
          <div style={css.col}><label style={css.lbl}>Valor Parcela (auto)</label><input style={{...css.inp,color:G}} type="number" value={f.parcelaValor||0} onChange={e=>set("parcelaValor",parseFloat(e.target.value)||0)}/></div>
          <div style={css.col}><label style={css.lbl}>Parcelas Pagas</label><input style={css.inp} type="number" value={f.parcelasPagas||0} onChange={e=>set("parcelasPagas",parseInt(e.target.value)||0)}/></div>
        </div>}
        <label style={css.lbl}>Observações</label><input style={css.inp} value={f.obs||""} onChange={e=>set("obs",e.target.value)}/>
        <label style={css.lbl}>Status</label>
        <select style={css.inp} value={f.status} onChange={e=>set("status",e.target.value)}>
          <option value="ativo">Ativo</option>
          <option value="inadimplente">Inadimplente</option>
          <option value="quitado">Quitado</option>
        </select>
        <div style={{display:"flex",gap:10,marginTop:12}}>
          <button style={{...css.btnO("#555"),flex:1}} onClick={onClose}>Cancelar</button>
          <button style={{...css.btn(G,true),flex:2}} onClick={()=>onSave(f)}>Salvar Alterações</button>
        </div>
      </div>
    </div>
  );
}

// -- P-GINA DO CLIENTE
function PaginaCliente({c,onClose,onEdit,onContrato,onParcela,updCliente}) {
  const [docs,setDocs]=useState(c.documentos||[]);
  const fileRef=useRef();

  const handleUpload=(e)=>{
    const files=Array.from(e.target.files);
    files.forEach(file=>{
      const reader=new FileReader();
      reader.onload=(ev)=>{
        const novoDoc={nome:file.name,tipo:file.type,data:ev.target.result,dataUpload:new Date().toLocaleDateString("pt-BR"),size:(file.size/1024).toFixed(0)+"KB"};
        const novos=[...docs,novoDoc];
        setDocs(novos);
        updCliente(c.id,{documentos:novos});
      };
      reader.readAsDataURL(file);
    });
  };

  const removerDoc=(idx)=>{
    const novos=docs.filter((_,i)=>i!==idx);
    setDocs(novos);
    updCliente(c.id,{documentos:novos});
  };

  const juros=c.tipo==="normal"?c.capital*0.30:c.parcelaValor;
  const quit=c.tipo==="normal"?c.capital+juros:c.parcelaValor*(c.parcelas-(c.parcelasPagas||0));
  const historico=c.historico||[];

  return (
    <div style={css.modal} onClick={onClose}>
      <div style={{...css.sheet,maxWidth:680,maxHeight:"95vh"}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:"#fff"}}>{c.nome}</div>
            <div style={{fontSize:11,color:"#555",marginTop:2}}>{c.cpf||"CPF não informado"} · {c.telefone||"Sem telefone"}</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <span style={css.badge(c.status==="ativo"?GR:c.status==="inadimplente"?RD:"#555")}>{c.status}</span>
            <button style={css.btnSm(S3)} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* A--es r-pidas */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
          {c.telefone&&<>
            <a href={`tel:${c.telefone}`} style={{...css.btnSm(BL),textDecoration:"none"}}>📞 Ligar</a>
            <a href={`https://wa.me/55${c.telefone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{...css.btnSm(GR),textDecoration:"none"}}>WhatsApp</a>
          </>}
          <button style={css.btnSm(G,true)} onClick={()=>onEdit(c)}>Editar</button>
          <button style={css.btnSm(BL)} onClick={()=>onContrato(c)}>Contrato</button>
          {c.tipo==="parcelado"&&(c.parcelasPagas||0)<c.parcelas&&(
            <button style={css.btnSm(GR)} onClick={()=>onParcela(c.id)}>+Parcela Paga</button>
          )}
        </div>

        {/* Dados financeiros */}
        <div style={{background:BG,borderRadius:12,padding:16,marginBottom:16,border:`1px solid ${G}22`}}>
          <div style={css.st}>Dados do Contrato</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:10}}>
            {[
              ["Capital",fmt(c.capital),G],
              ["Modalidade",c.tipo==="normal"?"Normal 30%":"Parcelado",PU],
              ["Vencimento","Dia "+c.venc,"#fff"],
              ["Início",c.dataInicio||"-","#fff"],
              c.tipo==="normal"?["Juros/mês",fmt(juros),GR]:["Parcela",fmt(c.parcelaValor),GR],
              c.tipo==="normal"?["Quitação",fmt(quit),RD]:["Pagas",`${c.parcelasPagas||0}/${c.parcelas}`,BL],
              ...(c.indicadoPor?[["Indicado por",c.indicadoPor,"#888"]]:[[]])
            ].filter(x=>x.length===3).map(([k,v,cor])=>(
              <div key={k} style={{background:S2,borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontSize:10,color:"#555"}}>{k}</div>
                <div style={{fontSize:13,fontWeight:700,color:cor}}>{v}</div>
              </div>
            ))}
          </div>
          {c.obs&&<div style={{marginTop:10,fontSize:12,color:"#666"}}>Obs: {c.obs}</div>}
        </div>

        {/* Hist-rico de pagamentos */}
        <div style={{...css.card,marginBottom:16}}>
          <div style={css.st}>Histórico de Pagamentos</div>
          {historico.length===0&&<div style={{fontSize:12,color:"#444"}}>Nenhum pagamento registrado ainda.</div>}
          {historico.map((h,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #1a1a1a",fontSize:12}}>
              <span style={{color:"#888"}}>{h.data}</span>
              <span style={{color:GR,fontWeight:700}}>{h.desc}</span>
              <span style={{color:G}}>{h.valor}</span>
            </div>
          ))}
        </div>

        {/* Documentos */}
        <div style={css.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={css.st}>Documentos</div>
            <button style={css.btnSm(G,true)} onClick={()=>fileRef.current.click()}>📎 Anexar</button>
            <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" style={{display:"none"}} onChange={handleUpload}/>
          </div>
          {docs.length===0&&<div style={{fontSize:12,color:"#444"}}>Nenhum documento anexado.</div>}
          {docs.map((d,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",background:BG,borderRadius:10,marginBottom:8,border:"1px solid #1c1c1c"}}>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:"#ccc"}}>{d.nome}</div>
                <div style={{fontSize:10,color:"#555"}}>{d.dataUpload} - {d.size}</div>
              </div>
              <div style={{display:"flex",gap:8}}>
                <a href={d.data} download={d.nome} style={{...css.btnSm(BL),textDecoration:"none"}}>-</a>
                <button style={css.btnSm(RD)} onClick={()=>removerDoc(i)}>-</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// -- CHECKLIST
const CHECKS=["Tem indica--o de algu-m da carteira?","Tem documento (RG/CPF/comprovante)?","Endere-o est-vel h- mais de 6 meses?","Tem renda comprovada ou aparente?","Tom calmo? Sem urg-ncia extrema?","Valor compat-vel com a renda?"];

// -- NOVO CLIENTE
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

  const calcParcela=()=>{
    if(f.tipo==="parcelado"&&f.capital&&f.parcelas){
      const pv=calcParcelaValor(parseFloat(f.capital),parseInt(f.parcelas));
      setF(p=>({...p,parcelaValor:(Math.round(pv*100)/100).toString()}));
    }
  };

  const handleAdd=async()=>{
    if(!f.nome||!f.capital){alert("Preencha nome e capital.");return;}
    const pv=f.tipo==="parcelado"?calcParcelaValor(parseFloat(f.capital),parseInt(f.parcelas)||1):0;
    await onAdd({...f,capital:parseFloat(f.capital),venc:parseInt(f.venc)||1,status:"ativo",parcelas:parseInt(f.parcelas)||0,parcelaValor:parseFloat(f.parcelaValor)||Math.round(pv*100)/100,parcelasPagas:0,documentos:[],historico:[]});
    setF(vazio);setChecks(Array(CHECKS.length).fill(false));
    alert("Cliente cadastrado!");
  };

  return (
    <div>
      <div style={css.card}>
        <div style={css.st}>Dados do Cliente</div>
        <div style={{position:"relative"}}>
          <label style={css.lbl}>Nome *</label>
          <input style={css.inp} value={f.nome} onChange={e=>onNome(e.target.value)} placeholder="Nome completo"/>
          {sugestoes.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:S2,border:"1px solid #222",borderRadius:10,zIndex:50,overflow:"hidden"}}>
            {sugestoes.map(c=><div key={c.id} onClick={()=>{setF(p=>({...p,nome:c.nome,cpf:c.cpf||"",telefone:c.telefone||"",endereco:c.endereco||"",indicadoPor:c.indicadoPor||""}));setSugestoes([]);}} style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid #1a1a1a",fontSize:12}}>
              <span style={{color:G}}>{c.nome}</span><span style={{color:"#555"}}> - j- cliente</span>
            </div>)}
          </div>}
        </div>
        <div style={css.row}>
          <div style={css.col}><label style={css.lbl}>CPF</label><input style={css.inp} value={f.cpf} onChange={e=>set("cpf",e.target.value)} placeholder="000.000.000-00"/></div>
          <div style={css.col}><label style={css.lbl}>Telefone</label><input style={css.inp} value={f.telefone} onChange={e=>set("telefone",e.target.value)} placeholder="(22) 99999-9999"/></div>
        </div>
        <label style={css.lbl}>Endere-o</label><input style={css.inp} value={f.endereco} onChange={e=>set("endereco",e.target.value)} placeholder="Rua, n-, bairro"/>
        <label style={css.lbl}>Indicado por</label><input style={css.inp} value={f.indicadoPor} onChange={e=>set("indicadoPor",e.target.value)}/>
      </div>

      <div style={css.card}>
        <div style={css.st}>Condi--es do Empr-stimo</div>
        <label style={css.lbl}>Modalidade</label>
        <select style={css.inp} value={f.tipo} onChange={e=>set("tipo",e.target.value)}>
          <option value="normal">Normal</option>
          <option value="parcelado">Parcelamento (35%/m-s)</option>
        </select>
        <div style={css.row}>
          <div style={css.col}><label style={css.lbl}>Valor (R$) *</label><input style={css.inp} type="number" value={f.capital} onChange={e=>set("capital",e.target.value)} onBlur={calcParcela} placeholder="Ex: 500"/></div>
          <div style={css.col}><label style={css.lbl}>Dia Vencimento</label><input style={css.inp} type="number" value={f.venc} onChange={e=>set("venc",e.target.value)} placeholder="Ex: 10"/></div>
        </div>
        {f.tipo==="parcelado"&&<>
          <div style={css.row}>
            <div style={css.col}><label style={css.lbl}>N- Parcelas</label><input style={css.inp} type="number" value={f.parcelas} onChange={e=>set("parcelas",e.target.value)} onBlur={calcParcela}/></div>
            <div style={css.col}>
              <label style={css.lbl}>Valor Parcela (calculado)</label>
              <input style={{...css.inp,color:G}} type="number" value={f.parcelaValor} onChange={e=>set("parcelaValor",e.target.value)} placeholder="Auto"/>
            </div>
          </div>
          {f.capital&&f.parcelas&&<div style={{background:BG,borderRadius:8,padding:"10px 14px",marginTop:4,border:`1px solid ${G}22`,fontSize:12,color:"#888"}}>
            {fmt(parseFloat(f.capital))} + ({fmt(parseFloat(f.capital))} - 35% - {f.parcelas}x) - {f.parcelas} = <span style={{color:G,fontWeight:700}}>{fmt(calcParcelaValor(parseFloat(f.capital),parseInt(f.parcelas)))}</span> por parcela
          </div>}
        </>}
        <div style={css.row}>
          <div style={css.col}><label style={css.lbl}>Data In-cio</label><input style={css.inp} value={f.dataInicio} onChange={e=>set("dataInicio",e.target.value)} placeholder="DD/MM/AAAA"/></div>
          <div style={css.col}><label style={css.lbl}>Observa--es</label><input style={css.inp} value={f.obs} onChange={e=>set("obs",e.target.value)}/></div>
        </div>
      </div>

      <div style={css.card}>
        <div style={css.st}>Checklist de An-lise</div>
        {CHECKS.map((item,i)=>(
          <div key={i} onClick={()=>setChecks(p=>p.map((v,j)=>j===i?!v:v))} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:"1px solid #111",cursor:"pointer"}}>
            <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checks[i]?GR:"#333"}`,background:checks[i]?GR:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {checks[i]&&<span style={{fontSize:11,color:"#000",fontWeight:800}}>-</span>}
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

// -- CARD CLIENTE (reus-vel)
function CardCliente({c,onVerCliente,showTelefone=true}) {
  return (
    <div style={{background:c.status==="inadimplente"?"#1a0505":S2,borderRadius:14,padding:16,marginBottom:12,border:`1px solid ${c.status==="inadimplente"?RD+"33":c.status==="quitado"?"#1c3322":"#1c1c1c"}`,cursor:"pointer"}} onClick={()=>onVerCliente(c)}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:c.status==="inadimplente"?RD:c.status==="quitado"?"#555":"#fff"}}>{c.nome}</div>
          {showTelefone&&c.telefone&&(
            <div style={{display:"flex",gap:8,marginTop:4}} onClick={e=>e.stopPropagation()}>
              <a href={`tel:${c.telefone}`} style={{fontSize:11,color:BL,textDecoration:"none"}}>{c.telefone}</a>
              <a href={`https://wa.me/55${c.telefone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:GR,textDecoration:"none"}}>WhatsApp</a>
            </div>
          )}
          {c.indicadoPor&&<div style={{fontSize:10,color:"#555",marginTop:2}}>Ind: {c.indicadoPor}</div>}
        </div>
        <span style={css.badge(c.status==="ativo"?GR:c.status==="inadimplente"?RD:"#555")}>
          {c.status==="ativo"?"Ativo":c.status==="inadimplente"?"Inadim.":"Quitado"}
        </span>
      </div>
      <div style={{display:"flex",gap:16}}>
        <div><div style={{fontSize:10,color:"#555"}}>Capital</div><div style={{fontSize:13,fontWeight:700,color:G}}>{fmt(c.capital)}</div></div>
        <div><div style={{fontSize:10,color:"#555"}}>Venc.</div><div style={{fontSize:13,fontWeight:700}}>Dia {c.venc}</div></div>
        {c.tipo==="normal"&&<div><div style={{fontSize:10,color:"#555"}}>Juros/m-s</div><div style={{fontSize:13,fontWeight:700,color:GR}}>{fmt(c.capital*0.30)}</div></div>}
        {c.tipo==="parcelado"&&<>
          <div><div style={{fontSize:10,color:"#555"}}>Parcela</div><div style={{fontSize:13,fontWeight:700,color:GR}}>{fmt(c.parcelaValor)}</div></div>
          <div><div style={{fontSize:10,color:"#555"}}>Pagas</div><div style={{fontSize:13,fontWeight:700}}>{c.parcelasPagas||0}/{c.parcelas}</div></div>
        </>}
      </div>
    </div>
  );
}

// -- APP
export default function App() {
  const [user,setUser]=useState(undefined);
  const [clientes,setClientes]=useState([]);
  const [tab,setTab]=useState(0);
  const [clienteModal,setClienteModal]=useState(null);
  const [editModal,setEditModal]=useState(null);
  const [contratoModal,setContratoModal]=useState(null);
  const [msgModal,setMsgModal]=useState(null);
  const [filtroTipo,setFiltroTipo]=useState(null);

  useEffect(()=>{ return onAuthStateChanged(auth,u=>setUser(u||null)); },[]);

  // Seed clientes iniciais se banco vazio
  useEffect(()=>{
    if(!user) return;
    const seedClientes = async () => {
      const iniciais = [
        {nome:"Vanessa Anselmo",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:200,venc:1,status:"ativo",indicadoPor:"",parcelas:0,parcelaValor:0,parcelasPagas:0,dataInicio:"01/04/2026",obs:"",documentos:[],historico:[]},
        {nome:"Michel 7cordas",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:300,venc:4,status:"ativo",indicadoPor:"",parcelas:0,parcelaValor:0,parcelasPagas:0,dataInicio:"01/04/2026",obs:"",documentos:[],historico:[]},
        {nome:"Maria de Fatima",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:200,venc:4,status:"ativo",indicadoPor:"",parcelas:0,parcelaValor:0,parcelasPagas:0,dataInicio:"01/04/2026",obs:"",documentos:[],historico:[]},
        {nome:"Vitoria - Brendler",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:200,venc:5,status:"ativo",indicadoPor:"",parcelas:0,parcelaValor:0,parcelasPagas:0,dataInicio:"01/04/2026",obs:"",documentos:[],historico:[]},
        {nome:"Marcelo Brendler",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:500,venc:6,status:"ativo",indicadoPor:"",parcelas:0,parcelaValor:0,parcelasPagas:0,dataInicio:"01/04/2026",obs:"",documentos:[],historico:[]},
        {nome:"Reginaldo - marido Tatiana",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:300,venc:6,status:"ativo",indicadoPor:"",parcelas:0,parcelaValor:0,parcelasPagas:0,dataInicio:"01/04/2026",obs:"",documentos:[],historico:[]},
        {nome:"Matheus Ferreira",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:200,venc:7,status:"ativo",indicadoPor:"",parcelas:0,parcelaValor:0,parcelasPagas:0,dataInicio:"01/04/2026",obs:"",documentos:[],historico:[]},
        {nome:"Daiane",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:500,venc:10,status:"ativo",indicadoPor:"",parcelas:0,parcelaValor:0,parcelasPagas:0,dataInicio:"01/04/2026",obs:"",documentos:[],historico:[]},
        {nome:"Janielle Barros",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:500,venc:20,status:"ativo",indicadoPor:"",parcelas:0,parcelaValor:0,parcelasPagas:0,dataInicio:"01/04/2026",obs:"",documentos:[],historico:[]},
        {nome:"Janaina - ind. Janielle",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:200,venc:23,status:"ativo",indicadoPor:"Janielle",parcelas:0,parcelaValor:0,parcelasPagas:0,dataInicio:"01/04/2026",obs:"",documentos:[],historico:[]},
        {nome:"Tatiana Ferreira (Yago)",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:200,venc:28,status:"ativo",indicadoPor:"",parcelas:0,parcelaValor:0,parcelasPagas:0,dataInicio:"01/04/2026",obs:"",documentos:[],historico:[]},
        {nome:"Wallace Viva cor",cpf:"",endereco:"",telefone:"",tipo:"parcelado",capital:400,venc:6,status:"ativo",indicadoPor:"",parcelas:6,parcelaValor:200,parcelasPagas:2,dataInicio:"01/04/2026",obs:"parcelamento toda sexta",documentos:[],historico:[]},
        {nome:"Rosiane - Priscila",cpf:"",endereco:"",telefone:"",tipo:"parcelado",capital:1200,venc:6,status:"ativo",indicadoPor:"Priscila",parcelas:6,parcelaValor:300,parcelasPagas:2,dataInicio:"01/04/2026",obs:"6x de R$300",documentos:[],historico:[]},
        {nome:"Olinda",cpf:"",endereco:"",telefone:"",tipo:"parcelado",capital:1014,venc:10,status:"ativo",indicadoPor:"",parcelas:3,parcelaValor:338,parcelasPagas:0,dataInicio:"01/04/2026",obs:"",documentos:[],historico:[]},
        {nome:"Anderson",cpf:"",endereco:"",telefone:"",tipo:"parcelado",capital:500,venc:18,status:"ativo",indicadoPor:"",parcelas:3,parcelaValor:296,parcelasPagas:0,dataInicio:"01/04/2026",obs:"Pegou dia 18/4 - 3x de R$296",documentos:[],historico:[]},
        {nome:"Priscila Brendler",cpf:"",endereco:"",telefone:"",tipo:"parcelado",capital:1800,venc:28,status:"ativo",indicadoPor:"",parcelas:9,parcelaValor:200,parcelasPagas:0,dataInicio:"01/04/2026",obs:"parcelamento 9x R$200",documentos:[],historico:[]},
      ];
      for(const c of iniciais){
        await addDoc(collection(db,"clientes"),{...c,criadoPor:user.uid,criadoEm:new Date().toISOString()});
      }
    };
    const q=query(collection(db,"clientes"),orderBy("criadoEm","asc"));
    const unsub = onSnapshot(q, snap=>{
      const docs = snap.docs.map(d=>({id:d.id,...d.data()}));
      if(docs.length===0){
        seedClientes();
      } else {
        setClientes(docs);
      }
    }, ()=>{});
    return ()=>unsub();
  },[user]);

  if(user===undefined) return <div style={{...css.app,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}><div style={{fontSize:22,fontWeight:800,color:G,fontFamily:"'Syne',sans-serif"}}>-RIACRED</div></div>;
  if(!user) return <Login/>;

  // C-lculos
  const ativos=clientes.filter(c=>c.status==="ativo");
  const inad=clientes.filter(c=>c.status==="inadimplente");
  const quitados=clientes.filter(c=>c.status==="quitado");
  const cN=ativos.filter(c=>c.tipo==="normal").reduce((s,c)=>s+(c.capital||0),0);
  const cP=ativos.filter(c=>c.tipo==="parcelado").reduce((s,c)=>s+(c.capital||0),0);
  const jN=cN*0.30;
  const jP=ativos.filter(c=>c.tipo==="parcelado").reduce((s,c)=>s+(c.parcelaValor||0),0);
  const base=cN+cP||0;
  const totJ=jN+jP;
  const pct=Math.min((base/1e6)*100,100);
  const dia=diaHoje();
  const semana=getSemanaAtual();
  const cobrarSemana=clientes.filter(c=>(venceNaSemana(c, semana))||c.status==="inadimplente").length;
  const cobrarHoje=cobrarSemana;

  // Helpers Firestore
  const addCliente=async(novo)=>{
    await addDoc(collection(db,"clientes"),{...novo,criadoPor:user.uid,criadoEm:new Date().toISOString()});
  };
  const updCliente=async(id,data)=>{ await updateDoc(doc(db,"clientes",id),data); };
  const delCliente=async(id)=>{ if(window.confirm("Excluir este cliente?")) await deleteDoc(doc(db,"clientes",id)); };

  const onParcela=(id)=>{
    const c=clientes.find(x=>x.id===id);
    if(!c) return;
    const n=(c.parcelasPagas||0)+1;
    const hist=[...(c.historico||[]),{data:hoje(),desc:`Parcela ${n}/${c.parcelas} paga`,valor:fmt(c.parcelaValor)}];
    updCliente(id,{parcelasPagas:n,status:n>=c.parcelas?"quitado":c.status,historico:hist});
  };

  const gerarMsg=(c,atrasado)=>{
    const s=saud(),n=c.nome.split(" ")[0];
    const j=c.tipo==="normal"?fmt(c.capital*0.30):fmt(c.parcelaValor);
    const q=c.tipo==="normal"?fmt(c.capital+c.capital*0.30):fmt(c.parcelaValor*(c.parcelas-(c.parcelasPagas||0)));
    if(atrasado) return `${s}, ${n}!\n\nPassando para informar que identificamos seu pagamento em aberto com a -riacred.\n\nValor dos juros: ${j}\nValor para quita--o total: ${q}${c.indicadoPor?"\n\nSeu contrato tem a indica--o de "+c.indicadoPor+", que ser- comunicado sobre a situa--o.":""}\n\nEntre em contato para regularizarmos.\n\n-riacred Solu--es Financeiras`;
    return `${s}, ${n}!\n\nPassando para lembrar que hoje, dia ${dia}, - o vencimento do seu contrato.\n\nValor dos juros do m-s: ${j}\nValor para quita--o total: ${q}\n\nAssim que fizer o pagamento nos envie o comprovante.\n\n-riacred Solu--es Financeiras`;
  };

  const exportarExcel=()=>{
    const sep=",";
    const cab=["Nome","CPF","Telefone","Endere-o","Modalidade","Capital","Taxa","Juros/M-s","Parcelas","Pagas","Valor Parcela","Total Parcelas","Vencimento","Status","Indicado Por","Data In-cio","Obs"];
    const rows=clientes.map(c=>{
      const j=c.tipo==="normal"?(c.capital*0.30).toFixed(2):c.parcelaValor||0;
      const tp=c.tipo==="normal"?"Normal 30%":"Parcelamento";
      return [
        `"${c.nome}"`,`"${c.cpf||""}"`,`"${c.telefone||""}"`,`"${c.endereco||""}"`,
        `"${tp}"`,c.capital,c.tipo==="normal"?"30%":"35%+35%+30%",j,
        c.parcelas||0,c.parcelasPagas||0,c.parcelaValor||0,
        c.tipo==="parcelado"?((c.parcelaValor||0)*c.parcelas).toFixed(2):"",
        c.venc,`"${c.status}"`,`"${c.indicadoPor||""}"`,`"${c.dataInicio||""}"`,`"${(c.obs||"").replace(/"/g,"''")}"`
      ].join(sep);
    });
    const totals=[
      `"TOTAIS",,,,,"${fmt(clientes.filter(c=>c.status==="ativo").reduce((s,c)=>s+(c.capital||0),0))}"`,
      `,,,,,,,,,,,,,,,,`,
      `"Clientes Ativos: ${ativos.length} | Inadimplentes: ${inad.length} | Quitados: ${quitados.length}"`,
      `"Capital Total: ${fmt(base)} | Juros/M-s: ${fmt(totJ)}"`,
      `"Relat-rio gerado em: ${hoje()}"`,
    ];
    const csv="\uFEFF"+[cab.join(sep),...rows,"",  ...totals].join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));
    a.download=`ariacred-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  const TABS=["Dashboard","Contratos","Clientes","Cobran-a","Novo Cliente","Relat-rio"];

  const verCliente=(c)=>{
    setClienteModal(c);
  };

  // Clientes que vencem essa semana
  const venceSemana=clientes.filter(c=>venceNaSemana(c, semana));

  return (
    <div style={css.app}>
      {/* TOP BAR */}
      <div style={{background:S1,borderBottom:"1px solid #1a1a1a",padding:"12px 20px",position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:920,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <img src={LOGO} alt="Áriacred" style={{width:36,height:36,borderRadius:8,objectFit:"cover"}}/>
            <div>
              <div style={{fontSize:16,fontWeight:800,color:G,fontFamily:"'Syne',sans-serif",letterSpacing:1}}>ÁRIACRED</div>
              <div style={{fontSize:9,color:"#444",letterSpacing:2}}>SOLUÇÕES FINANCEIRAS</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:13,fontWeight:700,color:GR}}>{fmtK(base)}</div>
              <div style={{fontSize:10,color:"#555"}}>{saud()}, {nomeDisplay(user)}</div>
            </div>
            <button style={{...css.btnSm(S3),color:"#666"}} onClick={()=>signOut(auth)}>Sair</button>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{background:S1,borderBottom:"1px solid #1a1a1a",position:"sticky",top:62,zIndex:99,overflowX:"auto"}}>
        <div style={{maxWidth:920,margin:"0 auto",display:"flex"}}>
          {TABS.map((t,i)=>(
            <button key={t} onClick={()=>setTab(i)} style={{flex:"none",padding:"12px 14px",fontSize:11,fontWeight:tab===i?700:400,color:tab===i?G:"#555",background:"none",border:"none",borderBottom:tab===i?`2px solid ${G}`:"2px solid transparent",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap",letterSpacing:.3,position:"relative"}}>
              {t}
              {i===3&&cobrarHoje>0&&<span style={{position:"absolute",top:6,right:2,background:RD,color:"#fff",borderRadius:10,fontSize:8,padding:"1px 5px",fontWeight:800}}>{cobrarHoje}</span>}
            </button>
          ))}
        </div>
      </div>

      <div style={css.wrap}>

        {/* -- DASHBOARD */}
        {tab===0&&<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:16}}>
            {[{l:"Capital",v:fmtK(base),c:GR},{l:"Juros/Mês",v:fmtK(totJ),c:G},{l:"Ativos",v:ativos.length,c:BL},{l:"Inadimplentes",v:inad.length,c:inad.length>0?RD:"#444"}]
            .map(({l,v,c})=>(
              <div key={l} style={{background:S2,borderRadius:14,padding:"14px 16px",border:`1px solid ${c}22`,textAlign:"center"}}>
                <div style={{fontSize:19,fontWeight:800,color:c}}>{v}</div>
                <div style={{fontSize:10,color:"#555",marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>

          {inad.length>0&&<div style={{background:"#1a0505",border:`1px solid ${RD}33`,borderRadius:12,padding:"12px 16px",marginBottom:16,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}} onClick={()=>setTab(3)}>
            <div><div style={{fontSize:13,fontWeight:700,color:RD}}>{inad.length} inadimplente{inad.length>1?"s":""}</div><div style={{fontSize:11,color:"#555"}}>Ver cobranças →</div></div>
          </div>}

          {/* Modalidades clic-veis */}
          <div style={css.card}>
            <div style={css.st}>Modalidades</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{background:BG,borderRadius:12,padding:"14px",border:`1px solid ${BL}22`,cursor:"pointer"}} onClick={()=>{setFiltroTipo("normal");setTab(2);}}>
                <div style={{fontSize:10,color:"#555",marginBottom:4}}>Normal (30%/mês)</div>
                <div style={{fontSize:17,fontWeight:800,color:BL}}>{fmtK(cN)}</div>
                <div style={{fontSize:11,color:GR}}>+{fmtK(jN)}/mês</div>
                <div style={{fontSize:10,color:"#444",marginTop:4}}>{ativos.filter(c=>c.tipo==="normal").length} clientes →</div>
              </div>
              <div style={{background:BG,borderRadius:12,padding:"14px",border:`1px solid ${PU}22`,cursor:"pointer"}} onClick={()=>{setFiltroTipo("parcelado");setTab(2);}}>
                <div style={{fontSize:10,color:"#555",marginBottom:4}}>Parcelamento</div>
                <div style={{fontSize:17,fontWeight:800,color:PU}}>{fmtK(cP)}</div>
                <div style={{fontSize:11,color:GR}}>+{fmtK(jP)}/mês</div>
                <div style={{fontSize:10,color:"#444",marginTop:4}}>{ativos.filter(c=>c.tipo==="parcelado").length} clientes →</div>
              </div>
            </div>
          </div>
        </>}

        {/* -- CONTRATOS */}
        {tab===1&&<>
          <div style={{marginBottom:14}}>
            <Calculadora inline={false}/>
          </div>
          <input style={{...css.inp,marginBottom:14}} placeholder="Buscar cliente..." onChange={e=>{
            const v=e.target.value.toLowerCase();
            document.querySelectorAll("[data-busca]").forEach(el=>{
              el.style.display=el.dataset.busca.includes(v)?"":"none";
            });
          }}/>
          {[...clientes.filter(c=>c.status!=="quitado")].sort((a,b)=>a.venc-b.venc).map(c=>(
            <div key={c.id} data-busca={c.nome.toLowerCase()}>
              <div style={{background:c.status==="inadimplente"?"#1a0505":S2,borderRadius:14,padding:16,marginBottom:12,border:`1px solid ${c.status==="inadimplente"?RD+"33":"#1c1c1c"}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                  <div style={{cursor:"pointer"}} onClick={()=>verCliente(c)}>
                    <div style={{fontSize:14,fontWeight:700,color:c.status==="inadimplente"?RD:"#fff",textDecoration:"underline",textDecorationColor:G+"44"}}>{c.nome}</div>
                    {c.telefone&&<div style={{display:"flex",gap:8,marginTop:4}} onClick={e=>e.stopPropagation()}>
                      <a href={`tel:${c.telefone}`} style={{fontSize:11,color:BL,textDecoration:"none"}}>{c.telefone}</a>
                      <a href={`https://wa.me/55${c.telefone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:GR,textDecoration:"none"}}>WhatsApp</a>
                    </div>}
                  </div>
                  <span style={css.badge(c.status==="ativo"?GR:c.status==="inadimplente"?RD:"#555")}>{c.status==="ativo"?"Ativo":c.status==="inadimplente"?"Inadim.":"Quitado"}</span>
                </div>
                <div style={{display:"flex",gap:14,marginBottom:10}}>
                  <div><div style={{fontSize:10,color:"#555"}}>Capital</div><div style={{fontSize:13,fontWeight:700,color:G}}>{fmt(c.capital)}</div></div>
                  <div><div style={{fontSize:10,color:"#555"}}>Venc.</div><div style={{fontSize:13,fontWeight:700}}>Dia {c.venc}</div></div>
                  {c.tipo==="normal"&&<div><div style={{fontSize:10,color:"#555"}}>Juros/mês</div><div style={{fontSize:13,fontWeight:700,color:GR}}>{fmt(c.capital*0.30)}</div></div>}
                  {c.tipo==="parcelado"&&<>
                    <div><div style={{fontSize:10,color:"#555"}}>Parcela</div><div style={{fontSize:13,fontWeight:700,color:GR}}>{fmt(c.parcelaValor)}</div></div>
                    <div><div style={{fontSize:10,color:"#555"}}>Pagas</div><div style={{fontSize:13,fontWeight:700}}>{c.parcelasPagas||0}/{c.parcelas}</div></div>
                  </>}
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button style={css.btnSm(G,true)} onClick={()=>setEditModal(c)}>Editar</button>
                  <button style={css.btnSm(BL)} onClick={()=>setContratoModal(c)}>Contrato</button>
                  {c.tipo==="parcelado"&&(c.parcelasPagas||0)<c.parcelas&&<button style={css.btnSm(GR)} onClick={()=>onParcela(c.id)}>+Parcela Paga</button>}
                  <button style={css.btnSm(RD)} onClick={()=>delCliente(c.id)}>Excluir</button>
                </div>
              </div>
            </div>
          ))}
        </>}

        {/* -- CLIENTES (com hist-rico de quitados) */}
        {tab===2&&<>
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            {[null,"normal","parcelado"].map(t=>(
              <button key={t||"todos"} style={{...css.btnSm(filtroTipo===t?G:S3,filtroTipo===t),border:filtroTipo===t?"none":`1px solid #222`}} onClick={()=>setFiltroTipo(t)}>
                {t===null?"Todos":t==="normal"?"Normal 30%":"Parcelamento"}
              </button>
            ))}
          </div>
          {[{titulo:"Ativos",lista:ativos,cor:GR},{titulo:`Inadimplentes`,lista:inad,cor:RD},{titulo:"Quitados",lista:quitados,cor:"#555"}].map(({titulo,lista,cor})=>{
            const filtrada=[...(filtroTipo?lista.filter(c=>c.tipo===filtroTipo):lista)].sort((a,b)=>a.venc-b.venc);
            if(filtrada.length===0) return null;
            return (
              <div key={titulo} style={{marginBottom:8}}>
                <div style={{fontSize:11,fontWeight:700,color:cor,marginBottom:10,textTransform:"uppercase",letterSpacing:1}}>{titulo} ({filtrada.length})</div>
                {filtrada.map(c=><CardCliente key={c.id} c={c} onVerCliente={verCliente}/>)}
              </div>
            );
          })}
        </>}

        {/* -- COBRAN-A */}
        {tab===3&&<>
          {cobrarSemana===0&&<div style={{...css.card,textAlign:"center",padding:32}}>
            <div style={{fontSize:28,color:GR,marginBottom:8}}>✓</div>
            <div style={{fontSize:14,color:GR,fontWeight:700}}>Sem cobranças esta semana</div>
            <div style={{fontSize:11,color:"#555",marginTop:4}}>Semana: {semana.label}</div>
          </div>}

          {[
            {titulo:`Cobrança da Semana (${semana.label})`,lista:clientes.filter(c=>venceNaSemana(c, semana)),atrasado:false,cor:G},
            {titulo:`Inadimplentes (${inad.length})`,lista:inad,atrasado:true,cor:RD},
          ].map(({titulo,lista,atrasado,cor})=>lista.length>0&&(
            <div key={titulo} style={css.card}>
              <div style={{...css.st,color:cor}}>{titulo}</div>
              {lista.map(c=>(
                <div key={c.id} style={{background:BG,borderRadius:12,padding:"12px 14px",marginBottom:10,border:`1px solid ${atrasado?RD+"22":"#1c1c1c"}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <div style={{cursor:"pointer"}} onClick={()=>verCliente(c)}>
                      <div style={{fontSize:13,fontWeight:700,color:atrasado?RD:G}}>{c.nome}</div>
                      {c.telefone&&<div style={{display:"flex",gap:8,marginTop:3}} onClick={e=>e.stopPropagation()}>
                        <a href={`tel:${c.telefone}`} style={{fontSize:11,color:BL,textDecoration:"none"}}>{c.telefone}</a>
                        <a href={`https://wa.me/55${c.telefone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{fontSize:11,color:GR,textDecoration:"none"}}>WhatsApp</a>
                      </div>}
                      <div style={{fontSize:11,color:"#555",marginTop:2}}>{c.tipo==="normal"?`Juros: ${fmt(c.capital*0.30)}`:`Parcela: ${fmt(c.parcelaValor)}`} · Dia {c.venc}</div>
                    </div>
                    <button style={css.btnSm(atrasado?RD:G,!atrasado)} onClick={()=>setMsgModal({c,atrasado})}>Mensagem</button>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button style={{...css.btnSm(GR),fontSize:11}} onClick={()=>{
                      const hist=[...(c.historico||[]),{data:hoje(),desc:c.tipo==="parcelado"?`Parcela ${(c.parcelasPagas||0)+1} paga`:"Juros pagos",valor:c.tipo==="normal"?fmt(c.capital*0.30):fmt(c.parcelaValor)}];
                      if(c.tipo==="parcelado"){const n=(c.parcelasPagas||0)+1;updCliente(c.id,{parcelasPagas:n,status:n>=c.parcelas?"quitado":"ativo",historico:hist});}
                      else{updCliente(c.id,{status:"ativo",historico:hist});}
                    }}>✓ Pago</button>
                    {!atrasado&&<button style={{...css.btnSm(RD),fontSize:11}} onClick={()=>updCliente(c.id,{status:"inadimplente"})}>Inadimplente</button>}
                    {atrasado&&<button style={{...css.btnSm(GR),fontSize:11}} onClick={()=>updCliente(c.id,{status:"ativo"})}>Regularizado</button>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>}

        {/* -- NOVO CLIENTE */}
        {tab===4&&<NovoClienteForm clientes={clientes} onAdd={addCliente}/>}

        {/* -- RELAT-RIO */}
        {tab===5&&<>
          <div style={css.cardG}>
            <div style={css.st}>Meta: R$ 1.000.000</div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <div style={{fontSize:12,color:"#555"}}>Capital atual</div>
              <div style={{fontSize:13,fontWeight:800,color:G}}>{pct.toFixed(1)}%</div>
            </div>
            <div style={{height:6,borderRadius:3,background:"#1a1a1a",marginBottom:10}}>
              <div style={{height:"100%",width:pct+"%",background:`linear-gradient(90deg,${G},${GR})`,borderRadius:3,transition:"width .6s"}}/>
            </div>
            <div style={{fontSize:11,color:"#555",marginBottom:14}}>Faltam <span style={{color:G,fontWeight:700}}>{fmtK(1e6-base)}</span></div>
            <GraficoMeta base={base}/>
          </div>

          <div style={css.cardG}>
            <div style={css.st}>Resumo da Carteira</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:12,marginBottom:16}}>
              {[[`Capital Total`,fmt(base),GR],[`Juros/Mês`,fmt(totJ),G],[`Ativos`,ativos.length,BL],[`Inadimplentes`,inad.length,inad.length>0?RD:"#444"],[`Quitados`,quitados.length,"#555"],[`Total`,clientes.length,"#888"]]
              .map(([k,v,c])=>(
                <div key={k} style={{background:BG,borderRadius:10,padding:"12px 14px",border:`1px solid ${c}22`}}>
                  <div style={{fontSize:10,color:"#555"}}>{k}</div>
                  <div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <button style={{...css.btn(GR),width:"100%"}} onClick={exportarExcel}>
              Exportar Excel (CSV)
            </button>
            <div style={{fontSize:10,color:"#555",marginTop:8,textAlign:"center"}}>Abre direto no Excel ou Google Sheets com totais</div>
          </div>

          <div style={css.card}>
            <div style={css.st}>Todos os Clientes</div>
            {clientes.map(c=>(
              <div key={c.id} onClick={()=>verCliente(c)} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #111",alignItems:"center",cursor:"pointer"}}>
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
      {clienteModal&&<PaginaCliente c={clienteModal} onClose={()=>setClienteModal(null)} onEdit={c=>{setEditModal(c);setClienteModal(null);}} onContrato={c=>{setContratoModal(c);setClienteModal(null);}} onParcela={id=>{onParcela(id);setClienteModal(null);}} updCliente={updCliente}/>}
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
            <pre style={{background:BG,borderRadius:12,padding:16,fontSize:12,color:"#ccc",whiteSpace:"pre-wrap",lineHeight:1.9,border:"1px solid #1c1c1c",fontFamily:"'DM Sans',sans-serif",marginBottom:14}}>{gerarMsg(msgModal.c,msgModal.atrasado)}</pre>
            <button style={{...css.btn(GR),width:"100%"}} onClick={()=>navigator.clipboard.writeText(gerarMsg(msgModal.c,msgModal.atrasado)).then(()=>{alert("Copiado!");setMsgModal(null);})}>
              Copiar para WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
