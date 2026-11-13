import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, getDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDAY0UCPHBSetl8D1VJiQ3NqrTVNVzt8hU",
  authDomain: "bite-express-f7d75.firebaseapp.com",
  projectId: "bite-express-f7d75",
  storageBucket: "bite-express-f7d75.firebasestorage.app",
  messagingSenderId: "163486652098",
  appId: "1:163486652098:web:9a509f6dd8d7d05bad0d5b",
  measurementId: "G-ZY8M6S8NHB"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const $ = id => document.getElementById(id);
let foods = [], categories = [], settings = { deliveryCharge: 0, codEnabled: true, onlineEnabled: false, upiId: "" };
let cart = JSON.parse(localStorage.getItem("bite_cart") || "[]");
let currentFilter = "all", selectedPayment = "COD", tick = null;

const fallbackFoods = [
 {id:"legacy-burger",name:"Veg Burger",category:"Burger",price:99,imageUrl:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",available:true},
 {id:"legacy-pizza",name:"Cheese Pizza",category:"Pizza",price:149,imageUrl:"https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80",available:true},
 {id:"legacy-chowmein",name:"Veg Chowmein",category:"Chowmein",price:99,imageUrl:"https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80",available:true},
 {id:"legacy-momos",name:"Momos",category:"Momos",price:79,imageUrl:"https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?auto=format&fit=crop&w=800&q=80",available:true},
 {id:"legacy-fries",name:"French Fries",category:"Burger",price:59,imageUrl:"https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80",available:true},
 {id:"legacy-drink",name:"Cold Drink",category:"Drinks",price:49,imageUrl:"https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=800&q=80",available:true}
];
function localMinutes(){const d=new Date();return d.getHours()*60+d.getMinutes();}
function timeMinutes(v){if(!v||!/^\d{2}:\d{2}$/.test(v))return null;const [h,m]=v.split(":").map(Number);return h*60+m;}
function isWithinWindow(from,to){const a=timeMinutes(from),b=timeMinutes(to);if(a===null||b===null)return true;const n=localMinutes();return a<=b?(n>=a&&n<b):(n>=a||n<b);}
function timeLabel(f){return f.availableFrom&&f.availableTo?`मिलेगा: ${f.availableFrom} से ${f.availableTo}`:"समय तय नहीं";}
function availability(f){if(f.available===false)return {ok:false,label:"अभी उपलब्ध नहीं"};if(!isWithinWindow(f.availableFrom,f.availableTo))return {ok:false,label:"अभी उपलब्ध नहीं"};return {ok:true,label:"अभी उपलब्ध है"};}
function effectivePrice(f){let p=Number(f.price)||0;const now=Date.now();let start=f.offerStartAt?.toDate?f.offerStartAt.toDate().getTime():f.offerStartAt?new Date(f.offerStartAt).getTime():null;let end=f.offerEndAt?.toDate?f.offerEndAt.toDate().getTime():f.offerEndAt?new Date(f.offerEndAt).getTime():null;const pct=Number(f.discountPercent)||0;if(pct>0&&(!start||now>=start)&&(!end||now<end))p=Math.max(0,Math.round(p*(1-pct/100)));return p;}
function renderCategories(){const root=$("categoryChips");if(!root)return;root.replaceChildren();const all=document.createElement("button");all.textContent="All";all.className=currentFilter==="all"?"active":"";all.onclick=()=>filterFood("all");root.append(all);const names=[...new Set([...categories.map(c=>c.name),...foods.map(f=>f.category).filter(Boolean)])];for(const name of names){const b=document.createElement("button");b.textContent=name;b.className=currentFilter===name?"active":"";b.onclick=()=>filterFood(name);root.append(b);}}
function renderFoods(){const q=($("search")?.value||"").toLowerCase();const root=$("foodGrid");if(!root)return;const list=foods.filter(f=>(currentFilter==="all"||f.category===currentFilter)&&(f.name||"").toLowerCase().includes(q));if(!list.length){root.innerHTML='<div class="empty">इस Category में अभी खाना उपलब्ध नहीं है।</div>';return;}root.replaceChildren();for(const f of list){const state=availability(f),price=effectivePrice(f),card=document.createElement("article");card.className="card";const img=document.createElement("img");img.className="food-img";img.src=f.imageUrl||f.image||"";img.alt=f.name||"Food";const body=document.createElement("div");body.className="card-body";const h=document.createElement("h3");h.textContent=f.name||"Food";const p=document.createElement("span");p.className="price";p.textContent=`₹${price}`;const time=document.createElement("span");time.className="food-time";time.textContent=timeLabel(f);const status=document.createElement("span");status.className=`food-state ${state.ok?"open":"closed"}`;status.textContent=state.label;body.append(h,p,time,status);if(price<(Number(f.price)||0)){const off=document.createElement("div");off.className="discount-line";off.textContent=`Offer price (पहले ₹${f.price})`;body.append(off);}const add=document.createElement("button");add.className="add";add.textContent=state.ok?"Add +":"Unavailable";add.disabled=!state.ok;add.addEventListener("click",()=>addToCart(f.id));body.append(add);card.append(img,body);root.append(card);}}
function filterFood(cat){currentFilter=cat;renderCategories();renderFoods();}
function findFood(id){return foods.find(f=>f.id===id)||fallbackFoods.find(f=>f.id===id);}
function addToCart(id){const f=findFood(id);if(!f||!availability(f).ok)return;const item=cart.find(x=>x.id===id);if(item)item.qty++;else cart.push({id:f.id,name:f.name,category:f.category,price:effectivePrice(f),qty:1,imageUrl:f.imageUrl||f.image||""});saveCart();openCart();}
function saveCart(){localStorage.setItem("bite_cart",JSON.stringify(cart));updateCartCount();renderCart();}
function updateCartCount(){$("cartCount").textContent=cart.reduce((s,x)=>s+x.qty,0);}
function totals(){const itemTotal=cart.reduce((s,x)=>s+Number(x.price)*x.qty,0);const delivery=itemTotal?Number(settings.deliveryCharge)||0:0;return {itemTotal,delivery,total:itemTotal+delivery};}
function renderCart(){const box=$("cartItems");if(!box)return;if(!cart.length)box.innerHTML='<div class="empty">आपका Cart खाली है।</div>';else box.innerHTML=cart.map(x=>`<div class="cart-row"><img src="${x.imageUrl||""}" alt=""><div class="grow"><strong>${escapeHtml(x.name)}</strong><div>₹${x.price}</div></div><div class="qty"><button type="button" onclick="changeQty('${String(x.id).replace(/'/g,"\\'")}',-1)">−</button> ${x.qty} <button type="button" onclick="changeQty('${String(x.id).replace(/'/g,"\\'")}',1)">+</button></div><strong>₹${x.price*x.qty}</strong></div>`).join("");const t=totals();$("itemTotal").textContent=`₹${t.itemTotal}`;$("delivery").textContent=`₹${t.delivery}`;$("grandTotal").textContent=`₹${t.total}`;}
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function changeQty(id,d){const x=cart.find(i=>String(i.id)===String(id));if(!x)return;x.qty+=d;if(x.qty<=0)cart=cart.filter(i=>i!==x);saveCart();}
function openCart(){renderCart();$("cartPanel").classList.remove("hidden");}
function closeCart(){$("cartPanel").classList.add("hidden");}
function showCheckout(){if(!cart.length){alert("पहले कोई सामान Cart में डालें।");return;}closeCart();renderPaymentOptions();$("checkoutPanel").classList.remove("hidden");}
function closeCheckout(){$("checkoutPanel").classList.add("hidden");}
function closeSuccess(){$("successPanel").classList.add("hidden");}
function renderPaymentOptions(){const root=$("paymentChoices");root.replaceChildren();const options=[];if(settings.codEnabled!==false)options.push(["COD","💵 Cash on Delivery"]);if(settings.onlineEnabled===true&&settings.upiId)options.push(["UPI","📱 Online Payment (UPI)"]);if(!options.length){root.textContent="फिलहाल कोई Payment विकल्प चालू नहीं है। कृपया बाद में कोशिश करें।";$("orderForm").querySelector("button[type=submit]").disabled=true;return;}$("orderForm").querySelector("button[type=submit]").disabled=false;if(!options.some(x=>x[0]===selectedPayment))selectedPayment=options[0][0];for(const [value,label] of options){const wrap=document.createElement("label");wrap.className="payment-choice";const radio=document.createElement("input");radio.type="radio";radio.name="paymentMethod";radio.value=value;radio.checked=value===selectedPayment;radio.addEventListener("change",()=>{selectedPayment=value;$("upiArea").hidden=value!=="UPI";});wrap.append(radio,document.createTextNode(label));root.append(wrap);}$("upiArea").hidden=selectedPayment!=="UPI";}
function makeUpiLink(amount,orderId){const params=new URLSearchParams({pa:settings.upiId,pn:"BITE EXPRESS",am:String(amount),cu:"INR",tn:`BITE EXPRESS ${orderId}`});return `upi://pay?${params.toString()}`;}
$("upiPayBtn").addEventListener("click",()=>{if(!settings.upiId){alert("Admin ने UPI ID सेट नहीं की है।");return;}window.location.href=makeUpiLink(totals().total,"Customer Order");});
async function placeOrder(e){e.preventDefault();const t=totals(),id="BX"+Date.now().toString().slice(-8);if(selectedPayment==="UPI"){if(!settings.upiId){alert("Admin ने अभी UPI ID सेट नहीं की है।");return;}const ref=$("upiReference").value.trim();if(!ref){alert("UPI Payment करने के बाद Transaction ID / UTR डालें।");return;}if(!confirm("क्या आपने UPI से ₹"+t.total+" भुगतान कर दिया है और सही UTR दर्ज किया है?"))return;}
for(const c of cart){const current=findFood(c.id);if(current&&!availability(current).ok){alert(`${current.name} अभी उपलब्ध नहीं है। Cart से हटाकर फिर ऑर्डर करें।`);return;}}
const order={id,name:$("name").value.trim(),phone:$("phone").value.trim(),address:$("address").value.trim(),items:cart.map(x=>({id:String(x.id),name:x.name,category:x.category||"",price:Number(x.price),quantity:x.qty})),total:t.total,status:"New",createdAt:serverTimestamp(),paymentMethod:selectedPayment,paymentStatus:selectedPayment==="COD"?"Pay on delivery":"UTR submitted",paymentReference:selectedPayment==="UPI"?$("upiReference").value.trim():""};
try{const ref=await addDoc(collection(db,"orders"),order);localStorage.setItem("bite_last_order",JSON.stringify({...order,createdAt:new Date().toISOString()}));cart=[];saveCart();closeCheckout();$("orderId").textContent="Order ID: "+id;$("firebaseDocId").textContent="Firebase Document ID: "+ref.id;$("successPanel").classList.remove("hidden");}catch(err){console.error(err);alert("ऑर्डर नहीं हो पाया। Internet/Firebase Rules जाँचें: "+(err.code||err.message));}}
window.filterFood=filterFood;window.addToCart=addToCart;window.changeQty=changeQty;window.openCart=openCart;window.closeCart=closeCart;window.showCheckout=showCheckout;window.closeCheckout=closeCheckout;window.closeSuccess=closeSuccess;
$("search").addEventListener("input",renderFoods);$("orderForm").addEventListener("submit",placeOrder);
onSnapshot(collection(db,"menu"),snap=>{foods=snap.docs.map(d=>({id:d.id,...d.data()}));if(!foods.length)foods=fallbackFoods;renderCategories();renderFoods();},err=>{console.error(err);foods=fallbackFoods;renderCategories();renderFoods();});
onSnapshot(collection(db,"categories"),snap=>{categories=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));renderCategories();},()=>renderCategories());
onSnapshot(doc(db,"settings","app"),snap=>{if(snap.exists())settings={...settings,...snap.data()};renderCart();renderPaymentOptions();renderFoods();},()=>{renderCart();renderPaymentOptions();});
renderCategories();renderFoods();updateCartCount();renderCart();
tick=setInterval(renderFoods,15000);
