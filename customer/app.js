import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import {
  getFirestore, collection, onSnapshot, doc, addDoc,
  serverTimestamp, query, where
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";

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
const auth = getAuth(app);
const $ = id => document.getElementById(id);

/* DELIVERY AREA */
const CENTER_LAT = 25.625833;
const CENTER_LNG = 74.924563;
const DELIVERY_RADIUS_KM = 3.8;
let customerLocation = null;

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const rad = n => n * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) *
    Math.cos(rad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* LOCATION PERMISSION */
function requestLocationOnFirstLaunch() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    () => {},
    () => {},
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

function getCustomerLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location is not available on this device."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      }),
      error => {
        if (error.code === 1) {
          reject(new Error("Please allow Location Permission."));
        } else if (error.code === 2) {
          reject(new Error("Please turn on your device Location and try again."));
        } else if (error.code === 3) {
          reject(new Error("Location request timed out. Please try again."));
        } else {
          reject(new Error("Unable to get your Location. Please try again."));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      }
    );
  });
}

async function checkDeliveryArea() {
  try {
    const loc = await getCustomerLocation();

    const distance = distanceKm(
      CENTER_LAT,
      CENTER_LNG,
      loc.latitude,
      loc.longitude
    );

    if (distance > DELIVERY_RADIUS_KM) {
      customerLocation = null;

      alert(
        "Sorry! BITE EXPRESS is not available in your area yet.\n\n" +
        "Your distance: " + distance.toFixed(2) + " KM\n" +
        "Delivery radius: 3.8 KM"
      );

      return false;
    }

    customerLocation = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      distanceKm: Number(distance.toFixed(3))
    };

    return true;

  } catch (error) {
    alert(error.message);
    return false;
  }
}

/* CUSTOMER LOGIN */
let customerUid = null;
let myOrdersUnsubscribe = null;

const authReady = new Promise((resolve, reject) => {
  let finished = false;
  let signInStarted = false;
  let unsubscribe = () => {};

  unsubscribe = onAuthStateChanged(auth, async user => {
    if (finished) return;

    if (user) {
      finished = true;
      customerUid = user.uid;
      unsubscribe();
      resolve(user.uid);
      return;
    }

    if (signInStarted) return;
    signInStarted = true;

    try {
      const result = await signInAnonymously(auth);

      if (!finished) {
        finished = true;
        customerUid = result.user.uid;
        unsubscribe();
        resolve(result.user.uid);
      }
    } catch (error) {
      finished = true;
      unsubscribe();
      reject(error);
    }
  });
});

/* APP DATA */
let foods = [];
let categories = [];

let settings = {
  deliveryCharge: 0,
  codEnabled: true,
  onlineEnabled: false,
  upiId: ""
};

let cart = JSON.parse(localStorage.getItem("bite_cart") || "[]");
let currentFilter = "all";
let selectedFoodType = "veg";
let selectedPayment = "COD";
let tick = null;

const fallbackFoods = [
  {
    id:"legacy-burger",
    name:"Veg Burger",
    category:"Burger",
    foodType:"veg",
    price:99,
    imageUrl:"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
    available:true
  },
  {
    id:"legacy-pizza",
    name:"Cheese Pizza",
    category:"Pizza",
    foodType:"veg",
    price:149,
    imageUrl:"https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80",
    available:true
  },
  {
    id:"legacy-chowmein",
    name:"Veg Chowmein",
    category:"Chowmein",
    foodType:"veg",
    price:99,
    imageUrl:"https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&q=80",
    available:true
  },
  {
    id:"legacy-momos",
    name:"Veg Momos",
    category:"Momos",
    foodType:"veg",
    price:79,
    imageUrl:"https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=800&q=80",
    available:true
  },
  {
    id:"legacy-fries",
    name:"French Fries",
    category:"Burger",
    foodType:"veg",
    price:59,
    imageUrl:"https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80",
    available:true
  },
  {
    id:"legacy-drink",
    name:"Cold Drink",
    category:"Drinks",
    foodType:"veg",
    price:49,
    imageUrl:"https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=800&q=80",
    available:true
  }
];

/* FOOD TYPE */
function foodTypeOf(food) {
  return String(food.foodType || "veg").toLowerCase() === "nonveg"
    ? "nonveg"
    : "veg";
}

/* VEG / NON-VEG BUTTONS */
function createFoodTypeTabs() {
  const categoryRoot = $("categoryChips");
  if (!categoryRoot || $("foodTypeTabs")) return;

  const tabs = document.createElement("div");
  tabs.id = "foodTypeTabs";

  tabs.style.display = "flex";
  tabs.style.gap = "12px";
  tabs.style.margin = "12px 0";
  tabs.style.width = "100%";

  const veg = document.createElement("button");
  veg.type = "button";
  veg.textContent = "🥬 VEG";
  veg.dataset.type = "veg";

  const nonveg = document.createElement("button");
  nonveg.type = "button";
  nonveg.textContent = "🍗 NON-VEG";
  nonveg.dataset.type = "nonveg";

  [veg, nonveg].forEach(button => {
    button.style.flex = "1";
    button.style.padding = "13px 10px";
    button.style.borderRadius = "12px";
    button.style.border = "2px solid #ffd21a";
    button.style.fontWeight = "800";
    button.style.fontSize = "15px";
    button.style.cursor = "pointer";
    button.addEventListener("click", () => {
      selectFoodType(button.dataset.type);
    });
  });

  tabs.append(veg, nonveg);
  categoryRoot.parentNode.insertBefore(tabs, categoryRoot);

  updateFoodTypeTabs();
}

function updateFoodTypeTabs() {
  const tabs = $("foodTypeTabs");
  if (!tabs) return;

  tabs.querySelectorAll("button").forEach(button => {
    const active = button.dataset.type === selectedFoodType;

    button.style.background = active ? "#ffd21a" : "#ffffff";
    button.style.color = "#111111";
    button.style.opacity = active ? "1" : "0.75";
  });
}

function selectFoodType(type) {
  selectedFoodType = type === "nonveg" ? "nonveg" : "veg";
  currentFilter = "all";

  updateFoodTypeTabs();
  renderCategories();
  renderFoods();
}

/* TIME AND FOOD AVAILABILITY */
function localMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function timeMinutes(v) {
  if (!v || !/^\d{2}:\d{2}$/.test(v)) return null;
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}

function formatTime12(v) {
  const mins = timeMinutes(v);
  if (mins === null) return v;

  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;

  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function isWithinWindow(from, to) {
  const a = timeMinutes(from);
  const b = timeMinutes(to);

  if (a === null || b === null) return true;

  const n = localMinutes();
  return a <= b ? (n >= a && n < b) : (n >= a || n < b);
}

function timeLabel(f) {
  return f.availableFrom && f.availableTo
    ? `Available: ${formatTime12(f.availableFrom)} to ${formatTime12(f.availableTo)}`
    : "Availability time not set";
}

function availability(f) {
  if (f.available === false) {
    return {ok:false, label:"Currently unavailable"};
  }

  if (!isWithinWindow(f.availableFrom, f.availableTo)) {
    return {ok:false, label:"Currently unavailable"};
  }

  return {ok:true, label:"Available now"};
}

function effectivePrice(f) {
  let p = Number(
    f.type === "combo" ? (f.comboPrice ?? f.price) : f.price
  ) || 0;

  if (f.type === "combo") return p;

  const now = Date.now();

  const start = f.offerStartAt?.toDate
    ? f.offerStartAt.toDate().getTime()
    : f.offerStartAt ? new Date(f.offerStartAt).getTime() : null;

  const end = f.offerEndAt?.toDate
    ? f.offerEndAt.toDate().getTime()
    : f.offerEndAt ? new Date(f.offerEndAt).getTime() : null;

  const pct = Number(f.discountPercent) || 0;

  if (pct > 0 && (!start || now >= start) && (!end || now < end)) {
    p = Math.max(0, Math.round(p * (1 - pct / 100)));
  }

  return p;
}

/* COMBO DETAILS */
function comboDescription(f) {
  if (f.type !== "combo" || !Array.isArray(f.comboItems)) return "";

  return f.comboItems.map(item => {
    const qty = Number(item.quantity) || 1;
    const free = Number(item.freeQuantity) || 0;
    const paid = Math.max(0, qty - free);

    let text = `${item.name} × ${qty}`;

    if (free > 0 && paid > 0) {
      text += ` (${free} FREE, ${paid} PAID)`;
    } else if (free > 0) {
      text += " (FREE)";
    }

    return text;
  }).join(" • ");
}

/* CATEGORY PHOTOS */
function renderCategories() {
  const root = $("categoryChips");
  if (!root) return;

  root.replaceChildren();

  const icons = {
    "Burger":"https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=100&h=100&fit=crop",
    "Pizza":"https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=100&h=100&fit=crop",
    "Chowmein":"https://images.unsplash.com/photo-1585032226651-759b368d7246?w=100&h=100&fit=crop",
    "Momos":"https://images.unsplash.com/photo-1625220194771-7ebdea0b70b9?w=100&h=100&fit=crop",
    "Drinks":"https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=100&h=100&fit=crop"
  };

  const visibleFoods = foods.filter(f =>
    foodTypeOf(f) === selectedFoodType
  );

  const all = document.createElement("button");
  all.textContent = "All";
  all.className = currentFilter === "all" ? "active" : "";
  all.onclick = () => filterFood("all");
  root.append(all);

  const names = [...new Set([
    ...categories.map(c => c.name).filter(name =>
      visibleFoods.some(f => f.category === name)
    ),
    ...visibleFoods.map(f => f.category).filter(Boolean)
  ])];

  for (const name of names) {
    const b = document.createElement("button");
    b.className = currentFilter === name ? "active" : "";

    if (icons[name]) {
      const img = document.createElement("img");
      img.className = "category-img";
      img.src = icons[name];
      img.alt = "";
      img.loading = "lazy";
      b.append(img);
    }

    b.append(document.createTextNode(name));
    b.onclick = () => filterFood(name);
    root.append(b);
  }
}

/* FOOD MENU */
function renderFoods() {
  const q = ($("search")?.value || "").toLowerCase();
  const root = $("foodGrid");
  if (!root) return;

  const list = foods.filter(f =>
    foodTypeOf(f) === selectedFoodType &&
    (currentFilter === "all" || f.category === currentFilter) &&
    (f.name || "").toLowerCase().includes(q)
  );

  if (!list.length) {
    root.innerHTML = '<div class="empty">No food available in this category yet.</div>';
    return;
  }

  root.replaceChildren();

  for (const f of list) {
    const state = availability(f);
    const price = effectivePrice(f);

    const card = document.createElement("article");
    card.className = "card";

    const img = document.createElement("img");
    img.className = "food-img";
    img.src = f.imageUrl || f.image || "";
    img.alt = f.name || "Food";

    const body = document.createElement("div");
    body.className = "card-body";

    const h = document.createElement("h3");
    h.textContent = f.name || "Food";

    const p = document.createElement("span");
    p.className = "price";
    p.textContent = `₹${price}`;

    body.append(h, p);

    if (f.type === "combo") {
      const details = document.createElement("div");
      details.className = "combo-details";
      details.textContent = comboDescription(f);
      details.style.fontSize = "13px";
      details.style.margin = "6px 0";
      body.append(details);
    }

    const time = document.createElement("span");
    time.className = "food-time";
    time.textContent = timeLabel(f);

    const status = document.createElement("span");
    status.className = `food-state ${state.ok ? "open" : "closed"}`;
    status.textContent = state.label;

    body.append(time, status);

    if (f.type !== "combo" && price < (Number(f.price) || 0)) {
      const off = document.createElement("div");
      off.className = "discount-line";
      off.textContent = `Offer price (Regular ₹${f.price})`;
      body.append(off);
    }

    const add = document.createElement("button");
    add.className = "add";
    add.textContent = state.ok ? "Add +" : "Unavailable";
    add.disabled = !state.ok;
    add.addEventListener("click", () => addToCart(f.id));

    body.append(add);
    card.append(img, body);
    root.append(card);
  }
}

function filterFood(cat) {
  currentFilter = cat;
  renderCategories();
  renderFoods();
}

function findFood(id) {
  return foods.find(f => f.id === id) ||
    fallbackFoods.find(f => f.id === id);
}

/* CART */
function addToCart(id) {
  const f = findFood(id);
  if (!f || !availability(f).ok) return;

  const item = cart.find(x => x.id === id);

  if (item) {
    item.qty++;
  } else {
    cart.push({
      id: f.id,
      name: f.name,
      category: f.category,
      foodType: foodTypeOf(f),
      type: f.type || "food",
      comboItems: f.type === "combo" ? (f.comboItems || []) : [],
      price: effectivePrice(f),
      qty: 1,
      imageUrl: f.imageUrl || f.image || ""
    });
  }

  saveCart();
  openCart();
}

function saveCart() {
  localStorage.setItem("bite_cart", JSON.stringify(cart));
  updateCartCount();
  renderCart();
}

function updateCartCount() {
  const count = $("cartCount");
  if (count) {
    count.textContent = cart.reduce((s, x) => s + x.qty, 0);
  }
}

function totals() {
  const itemTotal = cart.reduce(
    (s, x) => s + Number(x.price) * x.qty, 0
  );

  const delivery = itemTotal
    ? Number(settings.deliveryCharge) || 0
    : 0;

  return {
    itemTotal,
    delivery,
    total: itemTotal + delivery
  };
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[c]));
}

function renderCart() {
  const box = $("cartItems");
  if (!box) return;

  if (!cart.length) {
    box.innerHTML = '<div class="empty">Your cart is empty.</div>';
  } else {
    box.innerHTML = cart.map(x => `
      <div class="cart-row">
        <img src="${escapeHtml(x.imageUrl || "")}" alt="">
        <div class="grow">
          <strong>${escapeHtml(x.name)}</strong>
          <div>₹${Number(x.price) || 0}</div>
          ${x.type === "combo"
            ? `<small>${escapeHtml(comboDescription({type:"combo",comboItems:x.comboItems || []}))}</small>`
            : ""}
        </div>
        <div class="qty">
          <button type="button" onclick="changeQty('${String(x.id).replace(/'/g, "\\'")}',-1)">−</button>
          ${x.qty}
          <button type="button" onclick="changeQty('${String(x.id).replace(/'/g, "\\'")}',1)">+</button>
        </div>
        <strong>₹${Number(x.price) * x.qty}</strong>
      </div>
    `).join("");
  }

  const t = totals();

  if ($("itemTotal")) $("itemTotal").textContent = `₹${t.itemTotal}`;
  if ($("delivery")) $("delivery").textContent = `₹${t.delivery}`;
  if ($("grandTotal")) $("grandTotal").textContent = `₹${t.total}`;
}

function changeQty(id, d) {
  const x = cart.find(i => String(i.id) === String(id));
  if (!x) return;

  x.qty += d;

  if (x.qty <= 0) {
    cart = cart.filter(i => i !== x);
  }

  saveCart();
}

function openCart() {
  renderCart();
  $("cartPanel").classList.remove("hidden");
}

function closeCart() {
  $("cartPanel").classList.add("hidden");
}

/* CHECKOUT */
async function showCheckout() {
  if (!cart.length) {
    alert("Please add an item to your cart first.");
    return;
  }

  const inside = await checkDeliveryArea();
  if (!inside) return;

  closeCart();
  renderPaymentOptions();
  $("checkoutPanel").classList.remove("hidden");
}

function closeCheckout() {
  $("checkoutPanel").classList.add("hidden");
}

function closeSuccess() {
  $("successPanel").classList.add("hidden");
}

/* PAYMENT */
function renderPaymentOptions() {
  const root = $("paymentChoices");
  if (!root) return;

  root.replaceChildren();

  const options = [];

  if (settings.codEnabled !== false) {
    options.push(["COD", "💵 Cash on Delivery"]);
  }

  if (settings.onlineEnabled === true && settings.upiId) {
    options.push(["UPI", "📱 Online Payment (UPI)"]);
  }

  const submitButton = $("orderForm")?.querySelector('button[type="submit"]');

  if (!options.length) {
    root.textContent = "No payment method is currently available. Please try again later.";
    if (submitButton) submitButton.disabled = true;
    return;
  }

  if (submitButton) submitButton.disabled = false;

  if (!options.some(x => x[0] === selectedPayment)) {
    selectedPayment = options[0][0];
  }

  for (const [value, label] of options) {
    const wrap = document.createElement("label");
    wrap.className = "payment-choice";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "paymentMethod";
    radio.value = value;
    radio.checked = value === selectedPayment;

    radio.addEventListener("change", () => {
      selectedPayment = value;
      if ($("upiArea")) $("upiArea").hidden = value !== "UPI";
    });

    wrap.append(radio, document.createTextNode(label));
    root.append(wrap);
  }

  if ($("upiArea")) {
    $("upiArea").hidden = selectedPayment !== "UPI";
  }
}

function makeUpiLink(amount, orderId) {
  const params = new URLSearchParams({
    pa: settings.upiId,
    pn: "BITE EXPRESS",
    am: String(amount),
    cu: "INR",
    tn: `BITE EXPRESS ${orderId}`
  });

  return `upi://pay?${params.toString()}`;
}

$("upiPayBtn")?.addEventListener("click", () => {
  if (!settings.upiId) {
    alert("The Admin has not set a UPI ID.");
    return;
  }

  window.location.href = makeUpiLink(totals().total, "Customer Order");
});

/* PLACE ORDER */
async function placeOrder(e) {
  e.preventDefault();

  const submitButton = $("orderForm").querySelector('button[type="submit"]');
  submitButton.disabled = true;

  try {
    const inside = await checkDeliveryArea();
    if (!inside) return;

    await authReady;

    const t = totals();
    const id = "BX" + Date.now().toString().slice(-8);

    if (selectedPayment === "UPI") {
      if (!settings.upiId) {
        alert("The Admin has not set a UPI ID yet.");
        return;
      }

      const ref = $("upiReference").value.trim();

      if (!ref) {
        alert("After making the UPI payment, please enter the Transaction ID / UTR.");
        return;
      }

      if (!confirm(
        "Have you paid ₹" + t.total +
        " using UPI and entered the correct UTR?"
      )) return;
    }

    for (const c of cart) {
      const current = findFood(c.id);

      if (current && !availability(current).ok) {
        alert(`${current.name} is currently unavailable. Please remove it from your cart and try again.`);
        return;
      }
    }

    const order = {
      id,
      customerUid,
      name: $("name").value.trim(),
      phone: $("phone").value.trim(),
      address: $("address").value.trim(),

      items: cart.map(x => ({
        id: String(x.id),
        name: x.name,
        category: x.category || "",
        foodType: x.foodType || "veg",
        type: x.type || "food",
        comboItems: x.type === "combo" ? (x.comboItems || []) : [],
        price: Number(x.price),
        quantity: x.qty
      })),

      total: t.total,
      status: "New",
      createdAt: serverTimestamp(),
      paymentMethod: selectedPayment,
      paymentStatus: selectedPayment === "COD"
        ? "Pay on delivery"
        : "UTR submitted",
      paymentReference: selectedPayment === "UPI"
        ? $("upiReference").value.trim()
        : "",
      customerLocation
    };

    await addDoc(collection(db, "orders"), order);

    localStorage.setItem(
      "bite_last_order",
      JSON.stringify({
        ...order,
        createdAt: new Date().toISOString()
      })
    );

    cart = [];
    saveCart();
    closeCheckout();

    $("orderId").textContent = "Order ID: " + id;
    $("firebaseDocId").textContent = "";
    $("successPanel").classList.remove("hidden");

  } catch (err) {
    console.error(err);
    alert(
      "Order failed. Please check your Internet connection or Firebase Rules: " +
      (err.code || err.message)
    );
  } finally {
    submitButton.disabled = false;
  }
}

/* MY ORDERS */
function statusText(status) {
  const labels = {
    New: "New Order Received",
    Accepted: "Order Accepted",
    Preparing: "Food is Being Prepared",
    "Out for Delivery": "Out for Delivery",
    Delivered: "Order Delivered",
    Cancelled: "Order Cancelled"
  };

  return labels[status] || status || "Status unavailable";
}

function renderMyOrders(snapshot) {
  const root = $("myOrdersList");
  if (!root) return;

  if (snapshot.empty) {
    root.innerHTML = '<div class="empty">You have no orders yet.</div>';
    return;
  }

  const orders = snapshot.docs.map(d => ({
    docId: d.id,
    ...d.data()
  }));

  orders.sort((a, b) => {
    const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return tb - ta;
  });

  root.replaceChildren();

  for (const order of orders) {
    const card = document.createElement("div");
    card.className = "my-order-card";

    const heading = document.createElement("div");
    heading.className = "my-order-heading";

    const orderNo = document.createElement("strong");
    orderNo.textContent = "Order ID: " + (order.id || order.docId);

    const status = document.createElement("span");
    status.className =
      "my-order-status " +
      (order.status === "Cancelled" ? "cancelled" :
       order.status === "Delivered" ? "delivered" : "");

    status.textContent = statusText(order.status);
    heading.append(orderNo, status);

    const items = document.createElement("div");
    items.className = "my-order-items";
    items.textContent = (order.items || [])
      .map(item => {
        let text = `${item.name} × ${item.quantity}`;

        if (item.type === "combo" && Array.isArray(item.comboItems)) {
          const details = item.comboItems
            .map(part => `${part.name} × ${part.quantity}`)
            .join(", ");

          text += ` (${details})`;
        }

        return text;
      })
      .join(", ");

    const amount = document.createElement("div");
    amount.className = "my-order-total";
    amount.textContent = "Total Amount: ₹" + (order.total || 0);

    const payment = document.createElement("div");
    payment.className = "my-order-payment";
    payment.textContent = "Payment: " + (order.paymentMethod || "COD");

    card.append(heading, items, amount, payment);
    root.append(card);
  }
}

async function openMyOrders() {
  $("myOrdersPanel").classList.remove("hidden");
  $("myOrdersList").innerHTML =
    '<div class="empty">Loading your orders...</div>';

  try {
    await authReady;

    if (myOrdersUnsubscribe) {
      myOrdersUnsubscribe();
    }

    const q = query(
      collection(db, "orders"),
      where("customerUid", "==", customerUid)
    );

    myOrdersUnsubscribe = onSnapshot(
      q,
      renderMyOrders,
      error => {
        console.error(error);
        $("myOrdersList").innerHTML =
          '<div class="empty">Unable to load orders. Please check your Internet connection or Firebase Rules.</div>';
      }
    );

  } catch (error) {
    console.error(error);
    $("myOrdersList").innerHTML =
      '<div class="empty">Unable to verify customer account. Please reopen the app.</div>';
  }
}

function closeMyOrders() {
  $("myOrdersPanel").classList.add("hidden");
}

/* BUTTON FUNCTIONS */
window.filterFood = filterFood;
window.addToCart = addToCart;
window.changeQty = changeQty;
window.openCart = openCart;
window.closeCart = closeCart;
window.showCheckout = showCheckout;
window.closeCheckout = closeCheckout;
window.closeSuccess = closeSuccess;
window.openMyOrders = openMyOrders;
window.closeMyOrders = closeMyOrders;

/* EVENTS */
$("search")?.addEventListener("input", renderFoods);
$("orderForm")?.addEventListener("submit", placeOrder);

/* FIRESTORE MENU */
onSnapshot(collection(db, "menu"), snap => {
  foods = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  if (!foods.length) foods = fallbackFoods;

  if (!foods.some(f => foodTypeOf(f) === selectedFoodType)) {
    selectedFoodType = "veg";
  }

  createFoodTypeTabs();
  updateFoodTypeTabs();
  renderCategories();
  renderFoods();

}, err => {
  console.error(err);
  foods = fallbackFoods;
  createFoodTypeTabs();
  updateFoodTypeTabs();
  renderCategories();
  renderFoods();
});

/* CATEGORIES */
onSnapshot(collection(db, "categories"), snap => {
  categories = snap.docs
    .map(d => ({id: d.id, ...d.data()}))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  renderCategories();

}, () => renderCategories());

/* SETTINGS */
onSnapshot(doc(db, "settings", "app"), snap => {
  if (snap.exists()) {
    settings = {...settings, ...snap.data()};
  }

  renderCart();
  renderPaymentOptions();
  renderFoods();

}, () => {
  renderCart();
  renderPaymentOptions();
});

/* INITIAL DISPLAY */
createFoodTypeTabs();
updateFoodTypeTabs();
renderCategories();
renderFoods();
updateCartCount();
renderCart();

requestLocationOnFirstLaunch();

tick = setInterval(renderFoods, 15000);
