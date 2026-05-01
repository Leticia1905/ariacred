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
const LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAfQAAAH0CAYAAADL1t+KAAAAAXNSR0IAr
// -- CORES
const G="#C9A84C",BG="#000",S1="#0a0a0a",S2="#111",S3="#161616";
const GR="#22c55e",RD="#ef4444",BL="#3b82f6",PU="#a855f7";
// -- UTILS
const fmt = v => "R$ "+Number(v||0).toLocaleString("pt-BR",{minimumFractionDigits:2});
const fmtK = v => v>=1e6?"R$ "+(v/1e6).toFixed(2)+"M":v>=1e3?"R$ "+(v/1e3).toFixed(1)+"k":"R$
const hoje = () => new Date().toLocaleDateString("pt-BR");
const diaHoje = () => new Date().getDate();
const saud = () => { const h=new Date().getHours(); return h<12?"Bom dia":h<18?"Boa tarde":"B
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
const label = `${inicioDate.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})} a
// Para comparar com venc (dia do m-s), inclui todos os dias da semana
const dias = diasSemana.map(d => d.dia);
const mesAtual = hoje.getMonth();
return { inicio: inicioDate.getDate(), fim: fimDate.getDate(), dias, diasSemana, label, mes
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
card: { background:S2, borderRadius:16, padding:20, marginBottom:16, border:"1px solid #1c1
cardG: { background:"linear-gradient(135deg,#0a0f0a,#0d0d0d)", borderRadius:16, padding:20,
inp: { background:S1, border:"1px solid #222", borderRadius:10, padding:"12px 14px", color:
lbl: { fontSize:11, color:"#555", marginBottom:5, display:"block", letterSpacing:.5, textTr
btn: (c,dk=false) => ({ background:c, color:dk?"#000":"#fff", border:"none", borderRadius:1
btnSm: (c,dk=false) => ({ background:c, color:dk?"#000":"#fff", border:"none", borderRadius
btnO: c => ({ background:"transparent", color:c, border:`1px solid ${c}44`, borderRadius:10
badge: c => ({ display:"inline-flex", alignItems:"center", background:c+"18", color:c, bord
modal: { position:"fixed", inset:0, background:"#000000ee", zIndex:200, display:"flex", ali
sheet: { background:S1, borderRadius:"20px 20px 0 0", padding:24, width:"100%", maxWidth:64
row: { display:"flex", gap:12, flexWrap:"wrap" },
col: { flex:1, minWidth:130 },
st: { fontSize:11, fontWeight:700, color:G, marginBottom:12, textTransform:"uppercase", let
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
const m={"auth/wrong-password":"Senha incorreta.","auth/user-not-found":"E-mail não cad
setErr(m[e.code]||"Erro ao entrar.");
}
setLoad(false);
};
return (
<div style={{...css.app,display:"flex",alignItems:"center",justifyContent:"center",minHei
<div style={{width:"100%",maxWidth:400}}>
<div style={{textAlign:"center",marginBottom:36}}>
<img src={LOGO} alt="Áriacred" style={{width:90,height:90,borderRadius:14,objectFit
<div style={{fontSize:26,fontWeight:800,color:G,fontFamily:"'Syne',sans-serif",lett
<div style={{fontSize:11,color:"#444",letterSpacing:3,marginTop:4}}>SOLUÇÕES FINANC
</div>
<div style={css.card}>
<div style={{fontSize:15,fontWeight:700,marginBottom:18}}>{mode==="login"?"Entrar n
{mode==="register"&&<><label style={css.lbl}>Seu nome</label><input style={{...css.
<label style={css.lbl}>E-mail</label>
<input style={{...css.inp,marginBottom:12}} type="email" value={email} onChange={e=
<label style={css.lbl}>Senha</label>
<input style={{...css.inp,marginBottom:err?8:14}} type="password" value={pass} onCh
{err&&<div style={{color:RD,fontSize:12,marginBottom:12,padding:"8px 12px",backgrou
<button style={{...css.btn(G,true),width:"100%",padding:14,fontSize:14}} onClick={h
<div style={{textAlign:"center",marginTop:14,fontSize:12,color:"#555"}}>
{mode==="login"?"Não tem conta? ":"Já tem conta? "}
<span style={{color:G,cursor:"pointer",fontWeight:700}} onClick={()=>{setMode(mod
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
for(let i=0;i<12;i++){c=c+(c*0.28)+1000;pts.push({mes:meses[(mi+i+1)%12],val:Math.round(c)}
const meta=1e6,maxV=Math.max(meta,pts[pts.length-1].val);
const W=460,H=110,P=28;
const xs=i=>P+i*(W-P*2)/(pts.length-1);
const ys=v=>H-P-((v/maxV)*(H-P*2));
const path=pts.map((p,i)=>`${i===0?"M":"L"}${xs(i)},${ys(p.val)}`).join(" ");
const metaY=ys(meta);
const hitIdx=pts.findIndex(p=>p.val>=meta);
return (
<svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:H,display:"block"}}>
<defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={
<line x1={P} y1={metaY} x2={W-P} y2={metaY} stroke={G} strokeWidth={1} strokeDasharray=
<text x={W-P+2} y={metaY+4} fontSize={8} fill={G} opacity={.6}>R$1M</text>
<path d={path} fill="none" stroke="url(#gl)" strokeWidth={2.5} strokeLinecap="round" st
{pts.map((p,i)=>(
<g key={i}>
<circle cx={xs(i)} cy={ys(p.val)} r={i===hitIdx?5:2.5} fill={i===hitIdx?G:p.val>=me
<text x={xs(i)} y={H-3} fontSize={7} fill="#444" textAnchor="middle">{p.mes}</text>
{i===hitIdx&&<text x={xs(i)} y={ys(p.val)-9} fontSize={9} textAnchor="middle" fill=
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
<input style={{...css.inp,marginBottom:0}} type="number" value={cap} onChange={e=>s
</div>
<div style={css.col}>
<label style={css.lbl}>Modalidade</label>
<select style={{...css.inp,marginBottom:0}} value={tipo} onChange={e=>setTipo(e.tar
<option value="normal">Normal (30%/mês)</option>
<option value="parcelado">Parcelamento (35%/mês)</option>
</select>
</div>
{tipo==="parcelado"&&<div style={css.col}>
<label style={css.lbl}>Parcelas</label>
<input style={{...css.inp,marginBottom:0}} type="number" value={np} onChange={e=>se
</div>}
</div>
{capital>0&&<div style={{background:BG,borderRadius:12,padding:16,marginTop:14,border:`
<div><div style={{fontSize:10,color:"#555"}}>Capital</div><div style={{fontSize:15,fo
{tipo==="normal"&&<>
<div><div style={{fontSize:10,color:"#555"}}>Juros/mês</div><div style={{fontSize:1
<div><div style={{fontSize:10,color:"#555"}}>Quitação</div><div style={{fontSize:15
</>}
{tipo==="parcelado"&&<>
<div><div style={{fontSize:10,color:"#555"}}>Por parcela</div><div style={{fontSize
<div><div style={{fontSize:10,color:"#555"}}>Total {np}x</div><div style={{fontSize
<div><div style={{fontSize:10,color:"#555"}}>Juros total</div><div style={{fontSize
</>}
</div>}
</div>
);
}
// -- TEXTO CONTRATO
function textoContrato(c) {
const taxa=c.tipo==="normal"?"30%":"35%+35%+30%";
const juros=c.tipo==="normal"?fmt(c.capital*0.30):fmt(c.parcelaValor);
const quit=c.tipo==="normal"?fmt(c.capital+c.capital*0.30):fmt(c.parcelaValor*(c.parcelas-(
return `CONTRATO DE EMPRÉSTIMO PESSOAL
ÁRIACRED - SOLUÇÕES FINANCEIRAS
─────────────────────────────────
CREDOR: Áriacred Soluções Financeiras
DEVEDOR: ${c.nome}
CPF: ${c.cpf||"___.___.___-__"}
Endereço: ${c.endereco||"________________________________"}
Telefone: ${c.telefone||"(__) _____-____"}${c.indicadoPor?"\nIndicado por: "+c.indicadoPor:""
─────────────────────────────────
CONDIÇÕES
Modalidade: ${c.tipo==="normal"?"Normal - Juros Mensais (30%)":"Parcelado (35%+35%+30%)"}
Valor Emprestado: ${fmt(c.capital)}
Taxa: ${taxa}
${c.tipo==="normal"?`Juros Mensais: ${juros}\nDia de Vencimento: Dia ${c.venc}\nTotal Quitaçã
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
<button style={css.btnSm(G,true)} onClick={()=>navigator.clipboard.writeText(txt)
<button style={css.btnSm(S3)} onClick={onClose}>✕</button>
</div>
</div>
<pre style={{background:BG,borderRadius:12,padding:16,fontSize:11,color:"#bbb",whiteS
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
<div style={css.col}><label style={css.lbl}>Nome</label><input style={css.inp} valu
<div style={css.col}><label style={css.lbl}>CPF</label><input style={css.inp} value
</div>
<div style={css.row}>
<div style={css.col}><label style={css.lbl}>Telefone</label><input style={css.inp}
<div style={css.col}><label style={css.lbl}>Indicado por</label><input style={css.i
</div>
<label style={css.lbl}>Endereço</label><input style={css.inp} value={f.endereco||""}
<div style={css.row}>
<div style={css.col}>
<label style={css.lbl}>Modalidade</label>
<select style={css.inp} value={f.tipo} onChange={e=>set("tipo",e.target.value)}>
<option value="normal">Normal (30%/mês)</option>
<option value="parcelado">Parcelamento (35%/mês)</option>
</select>
</div>
<div style={css.col}><label style={css.lbl}>Capital (R$)</label><input style={css.i
</div>
<div style={css.row}>
<div style={css.col}><label style={css.lbl}>Dia Vencimento</label><input style={css
<div style={css.col}><label style={css.lbl}>Data Início</label><input style={css.in
</div>
{f.tipo==="parcelado"&&<div style={css.row}>
<div style={css.col}><label style={css.lbl}>Nº Parcelas</label><input style={css.in
<div style={css.col}><label style={css.lbl}>Valor Parcela (auto)</label><input styl
<div style={css.col}><label style={css.lbl}>Parcelas Pagas</label><input style={css
</div>}
<label style={css.lbl}>Observações</label><input style={css.inp} value={f.obs||""} on
<label style={css.lbl}>Status</label>
<select style={css.inp} value={f.status} onChange={e=>set("status",e.target.value)}>
<option value="ativo">Ativo</option>
<option value="inadimplente">Inadimplente</option>
<option value="quitado">Quitado</option>
</select>
<div style={{display:"flex",gap:10,marginTop:12}}>
<button style={{...css.btnO("#555"),flex:1}} onClick={onClose}>Cancelar</button>
<button style={{...css.btn(G,true),flex:2}} onClick={()=>onSave(f)}>Salvar Alteraçõ
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
const novoDoc={nome:file.name,tipo:file.type,data:ev.target.result,dataUpload:new Dat
const novos=[...docs,novoDoc];
setDocs(novos);
updCliente(c.id,{documentos:novos});
};
});
reader.readAsDataURL(file);
};
const removerDoc=(idx)=>{
const novos=docs.filter((_,i)=>i!==idx);
setDocs(novos);
updCliente(c.id,{documentos:novos});
};
const juros=c.tipo==="normal"?c.capital*0.30:c.parcelaValor;
const quit=c.tipo==="normal"?c.capital+juros:c.parcelaValor*(c.parcelas-(c.parcelasPagas||0
const historico=c.historico||[];
return (
<div style={css.modal} onClick={onClose}>
<div style={{...css.sheet,maxWidth:680,maxHeight:"95vh"}} onClick={e=>e.stopPropagation
{/* Header */}
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin
<div>
<div style={{fontSize:18,fontWeight:800,color:"#fff"}}>{c.nome}</div>
<div style={{fontSize:11,color:"#555",marginTop:2}}>{c.cpf||"CPF não informado"}
</div>
<div style={{display:"flex",gap:8,alignItems:"center"}}>
<span style={css.badge(c.status==="ativo"?GR:c.status==="inadimplente"?RD:"#555")
<button style={css.btnSm(S3)} onClick={onClose}>✕</button>
</div>
</div>
{/* A--es r-pidas */}
<div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:20}}>
{c.telefone&&<>
<a href={`tel:${c.telefone}`} style={{...css.btnSm(BL),textDecoration:"none"}}>
<a href={`https://wa.me/55${c.telefone.replace(/\D/g,"")}`} target="_blank" rel="
</>}
<button style={css.btnSm(G,true)} onClick={()=>onEdit(c)}>Editar</button>
<button style={css.btnSm(BL)} onClick={()=>onContrato(c)}>Contrato</button>
{c.tipo==="parcelado"&&(c.parcelasPagas||0)<c.parcelas&&(
<button style={css.btnSm(GR)} onClick={()=>onParcela(c.id)}>+Parcela Paga</button
)}
</div>
{/* Dados financeiros */}
<div style={{background:BG,borderRadius:12,padding:16,marginBottom:16,border:`1px sol
<div style={css.st}>Dados do Contrato</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))
{[
["Capital",fmt(c.capital),G],
["Modalidade",c.tipo==="normal"?"Normal 30%":"Parcelado",PU],
["Vencimento","Dia "+c.venc,"#fff"],
["Início",c.dataInicio||"-","#fff"],
c.tipo==="normal"?["Juros/mês",fmt(juros),GR]:["Parcela",fmt(c.parcelaValor),GR
c.tipo==="normal"?["Quitação",fmt(quit),RD]:["Pagas",`${c.parcelasPagas||0}/${c
...(c.indicadoPor?[["Indicado por",c.indicadoPor,"#888"]]:[[]])
].filter(x=>x.length===3).map(([k,v,cor])=>(
<div key={k} style={{background:S2,borderRadius:8,padding:"10px 12px"}}>
<div style={{fontSize:10,color:"#555"}}>{k}</div>
<div style={{fontSize:13,fontWeight:700,color:cor}}>{v}</div>
</div>
))}
</div>
</div>
{c.obs&&<div style={{marginTop:10,fontSize:12,color:"#666"}}>Obs: {c.obs}</div>}
{/* Hist-rico de pagamentos */}
<div style={{...css.card,marginBottom:16}}>
<div style={css.st}>Histórico de Pagamentos</div>
{historico.length===0&&<div style={{fontSize:12,color:"#444"}}>Nenhum pagamento reg
{historico.map((h,i)=>(
<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0
<span style={{color:"#888"}}>{h.data}</span>
<span style={{color:GR,fontWeight:700}}>{h.desc}</span>
<span style={{color:G}}>{h.valor}</span>
</div>
))}
</div>
Anexar
style=
{/* Documentos */}
<div style={css.card}>
<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marg
<div style={css.st}>Documentos</div>
<button style={css.btnSm(G,true)} onClick={()=>fileRef.current.click()}> <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx" </div>
{docs.length===0&&<div style={{fontSize:12,color:"#444"}}>Nenhum documento anexado.
{docs.map((d,i)=>(
<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"ce
<div>
<div style={{fontSize:12,fontWeight:600,color:"#ccc"}}>{d.nome}</div>
<div style={{fontSize:10,color:"#555"}}>{d.dataUpload} - {d.size}</div>
</div>
<div style={{display:"flex",gap:8}}>
<a href={d.data} download={d.nome} style={{...css.btnSm(BL),textDecoration:"n
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
const CHECKS=["Tem indica--o de algu-m da carteira?","Tem documento (RG/CPF/comprovante)?","E
// -- NOVO CLIENTE
function NovoClienteForm({clientes,onAdd}) {
const vazio={nome:"",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:"",venc:"",indica
const [f,setF]=useState(vazio);
const [checks,setChecks]=useState(Array(CHECKS.length).fill(false));
const [sugestoes,setSugestoes]=useState([]);
const [preview,setPreview]=useState(null);
const set=(k,v)=>setF(p=>({...p,[k]:v}));
const onNome=v=>{
set("nome",v);
if(v.length>=2) setSugestoes(clientes.filter(c=>c.nome.toLowerCase().includes(v.toLowerCa
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
const pv=f.tipo==="parcelado"?calcParcelaValor(parseFloat(f.capital),parseInt(f.parcelas)
await onAdd({...f,capital:parseFloat(f.capital),venc:parseInt(f.venc)||1,status:"ativo",p
setF(vazio);setChecks(Array(CHECKS.length).fill(false));
alert("Cliente cadastrado!");
};
return (
<div>
<div style={css.card}>
<div style={css.st}>Dados do Cliente</div>
<div style={{position:"relative"}}>
<label style={css.lbl}>Nome *</label>
<input style={css.inp} value={f.nome} onChange={e=>onNome(e.target.value)} placehol
{sugestoes.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,bac
{sugestoes.map(c=><div key={c.id} onClick={()=>{setF(p=>({...p,nome:c.nome,cpf:c.
<span style={{color:G}}>{c.nome}</span><span style={{color:"#555"}}> - j- clien
</div>)}
</div>}
</div>
<div style={css.row}>
<div style={css.col}><label style={css.lbl}>CPF</label><input style={css.inp} value
<div style={css.col}><label style={css.lbl}>Telefone</label><input style={css.inp}
</div>
<label style={css.lbl}>Endere-o</label><input style={css.inp} value={f.endereco} onCh
<label style={css.lbl}>Indicado por</label><input style={css.inp} value={f.indicadoPo
</div>
<div style={css.card}>
<div style={css.st}>Condi--es do Empr-stimo</div>
<label style={css.lbl}>Modalidade</label>
<select style={css.inp} value={f.tipo} onChange={e=>set("tipo",e.target.value)}>
<option value="normal">Normal</option>
<option value="parcelado">Parcelamento (35%/m-s)</option>
</select>
<div style={css.row}>
<div style={css.col}><label style={css.lbl}>Valor (R$) *</label><input style={css.i
<div style={css.col}><label style={css.lbl}>Dia Vencimento</label><input style={css
</div>
{f.tipo==="parcelado"&&<>
<div style={css.row}>
<div style={css.col}><label style={css.lbl}>N- Parcelas</label><input style={css.
<div style={css.col}>
<label style={css.lbl}>Valor Parcela (calculado)</label>
<input style={{...css.inp,color:G}} type="number" value={f.parcelaValor} </div>
</div>
{f.capital&&f.parcelas&&<div style={{background:BG,borderRadius:8,padding:"10px 14p
{fmt(parseFloat(f.capital))} + ({fmt(parseFloat(f.capital))} - 35% - {f.parcelas}
</div>}
</>}
<div style={css.row}>
<div style={css.col}><label style={css.lbl}>Data In-cio</label><input style={css.in
<div style={css.col}><label style={css.lbl}>Observa--es</label><input style={css.in
</div>
</div>
onChan
<div style={css.card}>
<div style={css.st}>Checklist de An-lise</div>
{CHECKS.map((item,i)=>(
<div key={i} onClick={()=>setChecks(p=>p.map((v,j)=>j===i?!v:v))} style={{display:"
<div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checks[i]?GR:"
{checks[i]&&<span style={{fontSize:11,color:"#000",fontWeight:800}}>-</span>}
</div>
<div style={{fontSize:12,color:checks[i]?"#444":"#ccc",textDecoration:checks[i]?"
</div>
))}
</div>
<div style={{display:"flex",gap:10,marginBottom:20}}>
<button style={{...css.btnO(BL),flex:1}} onClick={()=>{
if(!f.nome||!f.capital){alert("Preencha nome e capital.");return;}
setPreview({...f,id:"prev",capital:parseFloat(f.capital)||0,venc:parseInt(f.venc)||
}}>Ver Contrato</button>
<button style={{...css.btn(G,true),flex:2}} onClick={handleAdd}>Cadastrar Cliente</bu
</div>
{preview&&<ModalContrato c={preview} onClose={()=>setPreview(null)}/>}
</div>
);
}
// -- CARD CLIENTE (reus-vel)
function CardCliente({c,onVerCliente,showTelefone=true}) {
return (
<div style={{background:c.status==="inadimplente"?"#1a0505":S2,borderRadius:14,padding:16
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marg
<div>
<div style={{fontSize:14,fontWeight:700,color:c.status==="inadimplente"?RD:c.status
{showTelefone&&c.telefone&&(
<div style={{display:"flex",gap:8,marginTop:4}} onClick={e=>e.stopPropagation()}>
<a href={`tel:${c.telefone}`} style={{fontSize:11,color:BL,textDecoration:"none
<a href={`https://wa.me/55${c.telefone.replace(/\D/g,"")}`} target="_blank" rel
</div>
)}
{c.indicadoPor&&<div style={{fontSize:10,color:"#555",marginTop:2}}>Ind: {c.indicad
</div>
<span style={css.badge(c.status==="ativo"?GR:c.status==="inadimplente"?RD:"#555")}>
{c.status==="ativo"?"Ativo":c.status==="inadimplente"?"Inadim.":"Quitado"}
</span>
</div>
<div style={{display:"flex",gap:16}}>
<div><div style={{fontSize:10,color:"#555"}}>Capital</div><div style={{fontSize:13,fo
<div><div style={{fontSize:10,color:"#555"}}>Venc.</div><div style={{fontSize:13,font
{c.tipo==="normal"&&<div><div style={{fontSize:10,color:"#555"}}>Juros/m-s</div><div
{c.tipo==="parcelado"&&<>
<div><div style={{fontSize:10,color:"#555"}}>Parcela</div><div style={{fontSize:13,
<div><div style={{fontSize:10,color:"#555"}}>Pagas</div><div style={{fontSize:13,fo
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
{nome:"Vanessa Anselmo",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:200,venc
{nome:"Michel 7cordas",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:300,venc:
{nome:"Maria de Fatima",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:200,venc
{nome:"Vitoria - Brendler",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:200,v
{nome:"Marcelo Brendler",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:500,ven
{nome:"Reginaldo - marido Tatiana",cpf:"",endereco:"",telefone:"",tipo:"normal",capit
{nome:"Matheus Ferreira",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:200,ven
{nome:"Daiane",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:500,venc:10,statu
{nome:"Janielle Barros",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:500,venc
{nome:"Janaina - ind. Janielle",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:
{nome:"Tatiana Ferreira (Yago)",cpf:"",endereco:"",telefone:"",tipo:"normal",capital:
{nome:"Wallace Viva cor",cpf:"",endereco:"",telefone:"",tipo:"parcelado",capital:400,
{nome:"Rosiane - Priscila",cpf:"",endereco:"",telefone:"",tipo:"parcelado",capital:12
{nome:"Olinda",cpf:"",endereco:"",telefone:"",tipo:"parcelado",capital:1014,venc:10,s
{nome:"Anderson",cpf:"",endereco:"",telefone:"",tipo:"parcelado",capital:500,venc:18,
{nome:"Priscila Brendler",cpf:"",endereco:"",telefone:"",tipo:"parcelado",capital:180
];
for(const c of iniciais){
await addDoc(collection(db,"clientes"),{...c,criadoPor:user.uid,criadoEm:new Date().t
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
if(user===undefined) return <div style={{...css.app,display:"flex",alignItems:"center",just
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
const cobrarSemana=clientes.filter(c=>(venceNaSemana(c, semana))||c.status==="inadimplente"
const cobrarHoje=cobrarSemana;
// Helpers Firestore
const addCliente=async(novo)=>{
await addDoc(collection(db,"clientes"),{...novo,criadoPor:user.uid,criadoEm:new Date().to
};
const updCliente=async(id,data)=>{ await updateDoc(doc(db,"clientes",id),data); };
const delCliente=async(id)=>{ if(window.confirm("Excluir este cliente?")) await deleteDoc(d
const onParcela=(id)=>{
const c=clientes.find(x=>x.id===id);
if(!c) return;
const n=(c.parcelasPagas||0)+1;
const hist=[...(c.historico||[]),{data:hoje(),desc:`Parcela ${n}/${c.parcelas} paga`,valo
updCliente(id,{parcelasPagas:n,status:n>=c.parcelas?"quitado":c.status,historico:hist});
};
const gerarMsg=(c,atrasado)=>{
const s=saud(),n=c.nome.split(" ")[0];
const j=c.tipo==="normal"?fmt(c.capital*0.30):fmt(c.parcelaValor);
const q=c.tipo==="normal"?fmt(c.capital+c.capital*0.30):fmt(c.parcelaValor*(c.parcelas-(c
if(atrasado) return `${s}, ${n}!\n\nPassando para informar que identificamos seu pagament
return `${s}, ${n}!\n\nPassando para lembrar que hoje, dia ${dia}, - o vencimento do seu
};
const exportarExcel=()=>{
const sep=",";
const cab=["Nome","CPF","Telefone","Endere-o","Modalidade","Capital","Taxa","Juros/M-s","
const rows=clientes.map(c=>{
const j=c.tipo==="normal"?(c.capital*0.30).toFixed(2):c.parcelaValor||0;
const tp=c.tipo==="normal"?"Normal 30%":"Parcelamento";
return [
`"${c.nome}"`,`"${c.cpf||""}"`,`"${c.telefone||""}"`,`"${c.endereco||""}"`,
`"${tp}"`,c.capital,c.tipo==="normal"?"30%":"35%+35%+30%",j,
c.parcelas||0,c.parcelasPagas||0,c.parcelaValor||0,
c.tipo==="parcelado"?((c.parcelaValor||0)*c.parcelas).toFixed(2):"",
c.venc,`"${c.status}"`,`"${c.indicadoPor||""}"`,`"${c.dataInicio||""}"`,`"${(c.obs||"
].join(sep);
});
const totals=[
`"TOTAIS",,,,,"${fmt(clientes.filter(c=>c.status==="ativo").reduce((s,c)=>s+(c.capital|
`,,,,,,,,,,,,,,,,`,
`"Clientes Ativos: ${ativos.length} | Inadimplentes: ${inad.length} | Quitados: ${quita
`"Capital Total: ${fmt(base)} | Juros/M-s: ${fmt(totJ)}"`,
`"Relat-rio gerado em: ${hoje()}"`,
];
const csv="\uFEFF"+[cab.join(sep),...rows,"", ...totals].join("\n");
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
<div style={{background:S1,borderBottom:"1px solid #1a1a1a",padding:"12px 20px",positio
<div style={{maxWidth:920,margin:"0 auto",display:"flex",justifyContent:"space-betwee
<div style={{display:"flex",alignItems:"center",gap:12}}>
<img src={LOGO} alt="Áriacred" style={{width:36,height:36,borderRadius:8,objectFi
<div>
<div style={{fontSize:16,fontWeight:800,color:G,fontFamily:"'Syne',sans-serif",
<div style={{fontSize:9,color:"#444",letterSpacing:2}}>SOLUÇÕES FINANCEIRAS</di
</div>
</div>
<div style={{display:"flex",alignItems:"center",gap:14}}>
<div style={{textAlign:"right"}}>
<div style={{fontSize:13,fontWeight:700,color:GR}}>{fmtK(base)}</div>
<div style={{fontSize:10,color:"#555"}}>{saud()}, {nomeDisplay(user)}</div>
</div>
</div>
</div>
</div>
<button style={{...css.btnSm(S3),color:"#666"}} onClick={()=>signOut(auth)}>Sair<
{/* TABS */}
<div style={{background:S1,borderBottom:"1px solid #1a1a1a",position:"sticky",top:62,zI
<div style={{maxWidth:920,margin:"0 auto",display:"flex"}}>
{TABS.map((t,i)=>(
<button key={t} onClick={()=>setTab(i)} style={{flex:"none",padding:"12px 14px",f
{t}
{i===3&&cobrarHoje>0&&<span style={{position:"absolute",top:6,right:2,backgroun
</button>
))}
</div>
</div>
<div style={css.wrap}>
{/* -- DASHBOARD */}
{tab===0&&<>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))
{[{l:"Capital",v:fmtK(base),c:GR},{l:"Juros/Mês",v:fmtK(totJ),c:G},{l:"Ativos",v:
.map(({l,v,c})=>(
<div key={l} style={{background:S2,borderRadius:14,padding:"14px 16px",border:`
<div style={{fontSize:19,fontWeight:800,color:c}}>{v}</div>
<div style={{fontSize:10,color:"#555",marginTop:2}}>{l}</div>
</div>
))}
</div>
{inad.length>0&&<div style={{background:"#1a0505",border:`1px solid ${RD}33`,border
<div><div style={{fontSize:13,fontWeight:700,color:RD}}>{inad.length} inadimplent
</div>}
{/* Modalidades clic-veis */}
<div style={css.card}>
<div style={css.st}>Modalidades</div>
<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
<div style={{background:BG,borderRadius:12,padding:"14px",border:`1px solid ${B
<div style={{fontSize:10,color:"#555",marginBottom:4}}>Normal (30%/mês)</div>
<div style={{fontSize:17,fontWeight:800,color:BL}}>{fmtK(cN)}</div>
<div style={{fontSize:11,color:GR}}>+{fmtK(jN)}/mês</div>
<div style={{fontSize:10,color:"#444",marginTop:4}}>{ativos.filter(c=>c.tipo=
</div>
<div style={{background:BG,borderRadius:12,padding:"14px",border:`1px solid ${P
<div style={{fontSize:10,color:"#555",marginBottom:4}}>Parcelamento</div>
<div style={{fontSize:17,fontWeight:800,color:PU}}>{fmtK(cP)}</div>
<div style={{fontSize:11,color:GR}}>+{fmtK(jP)}/mês</div>
<div style={{fontSize:10,color:"#444",marginTop:4}}>{ativos.filter(c=>c.tipo=
</div>
</div>
</div>
</>}
{/* -- CONTRATOS */}
{tab===1&&<>
<div style={{marginBottom:14}}>
<Calculadora inline={false}/>
</div>
<input style={{...css.inp,marginBottom:14}} placeholder="Buscar cliente..." onChang
const v=e.target.value.toLowerCase();
document.querySelectorAll("[data-busca]").forEach(el=>{
el.style.display=el.dataset.busca.includes(v)?"":"none";
});
}}/>
{[...clientes.filter(c=>c.status!=="quitado")].sort((a,b)=>a.venc-b.venc).map(c=>(
<div key={c.id} data-busca={c.nome.toLowerCase()}>
<div style={{background:c.status==="inadimplente"?"#1a0505":S2,borderRadius:14,
<div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-s
<div style={{cursor:"pointer"}} onClick={()=>verCliente(c)}>
<div style={{fontSize:14,fontWeight:700,color:c.status==="inadimplente"?R
{c.telefone&&<div style={{display:"flex",gap:8,marginTop:4}} onClick={e=>
<a href={`tel:${c.telefone}`} style={{fontSize:11,color:BL,textDecorati
<a href={`https://wa.me/55${c.telefone.replace(/\D/g,"")}`} target="_bl
</div>}
</div>
<span style={css.badge(c.status==="ativo"?GR:c.status==="inadimplente"?RD:"
</div>
<div style={{display:"flex",gap:14,marginBottom:10}}>
<div><div style={{fontSize:10,color:"#555"}}>Capital</div><div style={{font
<div><div style={{fontSize:10,color:"#555"}}>Venc.</div><div style={{fontSi
{c.tipo==="normal"&&<div><div style={{fontSize:10,color:"#555"}}>Juros/mês<
{c.tipo==="parcelado"&&<>
<div><div style={{fontSize:10,color:"#555"}}>Parcela</div><div style={{fo
<div><div style={{fontSize:10,color:"#555"}}>Pagas</div><div style={{font
</>}
</div>
<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
<button style={css.btnSm(G,true)} onClick={()=>setEditModal(c)}>Editar</but
<button style={css.btnSm(BL)} onClick={()=>setContratoModal(c)}>Contrato</b
{c.tipo==="parcelado"&&(c.parcelasPagas||0)<c.parcelas&&<button style={css.
<button style={css.btnSm(RD)} onClick={()=>delCliente(c.id)}>Excluir</butto
</div>
</div>
</div>
))}
</>}
{/* -- CLIENTES (com hist-rico de quitados) */}
{tab===2&&<>
<div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
{[null,"normal","parcelado"].map(t=>(
<button key={t||"todos"} style={{...css.btnSm(filtroTipo===t?G:S3,filtroTipo===
{t===null?"Todos":t==="normal"?"Normal 30%":"Parcelamento"}
</button>
))}
</div>
{[{titulo:"Ativos",lista:ativos,cor:GR},{titulo:`Inadimplentes`,lista:inad,cor:RD},
const filtrada=[...(filtroTipo?lista.filter(c=>c.tipo===filtroTipo):lista)].sort(
if(filtrada.length===0) return null;
return (
<div key={titulo} style={{marginBottom:8}}>
<div style={{fontSize:11,fontWeight:700,color:cor,marginBottom:10,textTransfo
{filtrada.map(c=><CardCliente key={c.id} c={c} onVerCliente={verCliente}/>)}
</div>
);
})}
</>}
{/* -- COBRAN-A */}
{tab===3&&<>
{cobrarSemana===0&&<div style={{...css.card,textAlign:"center",padding:32}}>
<div style={{fontSize:28,color:GR,marginBottom:8}}>✓</div>
<div style={{fontSize:14,color:GR,fontWeight:700}}>Sem cobranças esta semana</div
<div style={{fontSize:11,color:"#555",marginTop:4}}>Semana: {semana.label}</div>
</div>}
{[
{titulo:`Cobrança da Semana (${semana.label})`,lista:clientes.filter(c=>venceNaSe
{titulo:`Inadimplentes (${inad.length})`,lista:inad,atrasado:true,cor:RD},
].map(({titulo,lista,atrasado,cor})=>lista.length>0&&(
<div key={titulo} style={css.card}>
<div style={{...css.st,color:cor}}>{titulo}</div>
{lista.map(c=>(
<div key={c.id} style={{background:BG,borderRadius:12,padding:"12px 14px",mar
<div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}
<div style={{cursor:"pointer"}} onClick={()=>verCliente(c)}>
<div style={{fontSize:13,fontWeight:700,color:atrasado?RD:G}}>{c.nome}<
{c.telefone&&<div style={{display:"flex",gap:8,marginTop:3}} onClick={e
<a href={`tel:${c.telefone}`} style={{fontSize:11,color:BL,textDecora
<a href={`https://wa.me/55${c.telefone.replace(/\D/g,"")}`} target="_
</div>}
<div style={{fontSize:11,color:"#555",marginTop:2}}>{c.tipo==="normal"?
</div>
<button style={css.btnSm(atrasado?RD:G,!atrasado)} onClick={()=>setMsgMod
</div>
<div style={{display:"flex",gap:8}}>
<button style={{...css.btnSm(GR),fontSize:11}} onClick={()=>{
const hist=[...(c.historico||[]),{data:hoje(),desc:c.tipo==="parcelado"
if(c.tipo==="parcelado"){const n=(c.parcelasPagas||0)+1;updCliente(c.id
else{updCliente(c.id,{status:"ativo",historico:hist});}
}}>✓ Pago</button>
{!atrasado&&<button style={{...css.btnSm(RD),fontSize:11}} onClick={()=>u
{atrasado&&<button style={{...css.btnSm(GR),fontSize:11}} onClick={()=>up
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
<div style={{height:"100%",width:pct+"%",background:`linear-gradient(90deg,${G}
</div>
<div style={{fontSize:11,color:"#555",marginBottom:14}}>Faltam <span style={{colo
<GraficoMeta base={base}/>
</div>
<div style={css.cardG}>
<div style={css.st}>Resumo da Carteira</div>
<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr
{[[`Capital Total`,fmt(base),GR],[`Juros/Mês`,fmt(totJ),G],[`Ativos`,ativos.len
.map(([k,v,c])=>(
<div key={k} style={{background:BG,borderRadius:10,padding:"12px 14px",border
<div style={{fontSize:10,color:"#555"}}>{k}</div>
<div style={{fontSize:16,fontWeight:800,color:c}}>{v}</div>
</div>
))}
</div>
<button style={{...css.btn(GR),width:"100%"}} onClick={exportarExcel}>
Exportar Excel (CSV)
</button>
<div style={{fontSize:10,color:"#555",marginTop:8,textAlign:"center"}}>Abre diret
</div>
<div style={css.card}>
<div style={css.st}>Todos os Clientes</div>
{clientes.map(c=>(
<div key={c.id} onClick={()=>verCliente(c)} style={{display:"flex",justifyConte
<div>
<div style={{fontSize:13,fontWeight:600,color:c.status==="inadimplente"?RD:
<div style={{fontSize:10,color:"#444"}}>{c.tipo==="normal"?`Juros: ${fmt(c.
</div>
<div style={{textAlign:"right"}}>
<div style={{fontSize:13,fontWeight:700,color:G}}>{fmt(c.capital)}</div>
<span style={css.badge(c.status==="ativo"?GR:c.status==="inadimplente"?RD:"
</div>
</div>
))}
</div>
</>}
</div>
{/* MODAIS */}
{clienteModal&&<PaginaCliente c={clienteModal} onClose={()=>setClienteModal(null)} onEd
{editModal&&<ModalEditar c={editModal} onSave={f=>{updCliente(f.id,f);setEditModal(null
{contratoModal&&<ModalContrato c={contratoModal} onClose={()=>setContratoModal(null)}/>
{msgModal&&(
<div style={css.modal} onClick={()=>setMsgModal(null)}>
<div style={css.sheet} onClick={e=>e.stopPropagation()}>
<div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
<div style={{fontSize:14,fontWeight:800,color:G}}>Mensagem de Cobrança</div>
<button style={css.btnSm(S3)} onClick={()=>setMsgModal(null)}>✕</button>
</div>
<div style={{fontSize:11,color:"#555",marginBottom:10}}>Para: {msgModal.c.nome}</
<pre style={{background:BG,borderRadius:12,padding:16,fontSize:12,color:"#ccc",wh
<button style={{...css.btn(GR),width:"100%"}} onClick={()=>navigator.clipboard.wr
Copiar para WhatsApp
</button>
</div>
}
);
</div>
)}
</div>