// ═════════════════════════════════════════════════════════════
// 🔴 CONFIGURATION
// ═════════════════════════════════════════════════════════════
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY_HERE';
const EMAILJS_SERVICE_ID = 'service_iv2hmdn';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID_HERE';
const ABSTRACT_API_KEY = '5a9793d19ff1427b84b27e57b9ac8b5b';
const RAZORPAY_KEY_ID = 'rzp_test_TBlfioJiVtjlch';
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbyQW4ASjboEvbWpOVNuxCE3vQhWPQVZnTgmhVVouZW6iiew0o-QEaIcGqXVzTaKhCW3ag/exec';

(function() {
  if (EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY_HERE') {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }
})();

// Global variables
let cart = [];
let currentMethod = 'card';
let orderTotal = 0;
let upiTimerInterval = null;
let isEmailVerified = false;
let generatedEmailOTP = null;
let zipCheckToken = 0;

// ── NAV SCROLL
window.addEventListener('scroll', () => {
  const nav = document.getElementById('nav');
  nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

// ── SCROLL REVEAL
(function() {
  const revEls = document.querySelectorAll('.rev');
  if (!revEls.length) return;
  function revealAll() { revEls.forEach(el => el.classList.add('in')); }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('in'); io.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    revEls.forEach(el => io.observe(el));
  } else { revealAll(); }
  window.addEventListener('load', () => setTimeout(revealAll, 1200));
  setTimeout(revealAll, 2500);
})();

// ── CART FUNCTIONS
function getSelections(pid) {
  const card = document.querySelector('[data-pid="' + pid + '"]');
  if (!card) return { size: 'III', colour: 'Black' };
  const sBtn = card.querySelector('.szpill.active');
  const sSw = card.querySelector('.pswatch.active');
  return { size: sBtn ? sBtn.textContent : 'III', colour: sSw ? sSw.title : 'Black' };
}

function addToCart(pid, name, img, price) {
  const { size, colour } = getSelections(pid);
  const key = `${pid}-${size}-${colour}`;
  const existing = cart.find(i => i.key === key);
  if (existing) { existing.qty += 1; }
  else { cart.push({ key, pid, name, img, price, size, colour, qty: 1 }); }
  updateCartBadge();
  renderCart();
  showToast(`${name} added to cart.`);
}

function updateCartBadge() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById('cartBadge');
  badge.textContent = total;
  badge.classList.toggle('show', total > 0);
}

function chgQty(key, delta) {
  const idx = cart.findIndex(item => item.key === key);
  if (idx === -1) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  updateCartBadge();
  renderCart();
}
window.chgQty = chgQty;

function rmItem(key) {
  cart = cart.filter(item => item.key !== key);
  updateCartBadge();
  renderCart();
}
window.rmItem = rmItem;

function renderCart() {
  const body = document.getElementById('cdBody');
  const empty = document.getElementById('cdEmpty');
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);
  const sum = cart.reduce((s, i) => s + (i.qty * i.price), 0);
  document.getElementById('cdCount').textContent = totalQty + ' item' + (totalQty !== 1 ? 's' : '');
  document.getElementById('cdTotal').textContent = '₹' + sum.toFixed(2);
  body.querySelectorAll('.cd-item').forEach(el => el.remove());
  if (cart.length === 0) { empty.style.display = 'flex'; return; }
  empty.style.display = 'none';
  cart.forEach(item => {
    const el = document.createElement('div');
    el.className = 'cd-item';
    el.innerHTML = `<img class="cd-item-img" src="${item.img}" alt="${item.name}" onerror="this.style.opacity='.3'"/>
      <div><div class="cd-item-brand">Juzo · Ovena Health</div><div class="cd-item-name">${item.name}</div>
      <div class="cd-item-meta">${item.colour} · Size ${item.size}</div>
      <div class="cd-qty"><button class="cd-qty-btn" onclick="chgQty('${item.key}', -1)">−</button>
      <div class="cd-qty-val">${item.qty}</div>
      <button class="cd-qty-btn" onclick="chgQty('${item.key}', 1)">+</button></div>
      <button class="cd-remove" onclick="rmItem('${item.key}')">✕ Remove</button></div>
      <div class="cd-item-price">₹${(item.price * item.qty).toFixed(2)}</div>`;
    body.appendChild(el);
  });
}

function openCart() {
  document.getElementById('cartOverlay').classList.add('open');
  document.getElementById('cartDrawer').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  document.getElementById('cartOverlay').classList.remove('open');
  document.getElementById('cartDrawer').classList.remove('open');
  document.body.style.overflow = '';
}
window.openCart = openCart;
window.closeCart = closeCart;

// ── CHECKOUT
function doCheckout() {
  if (cart.length === 0) { showToast('Your cart is empty.'); return; }
  closeCart();
  orderTotal = cart.reduce((s, i) => s + (i.qty * i.price), 0);
  document.getElementById('paymentSummary').innerHTML = buildOrderSummaryHTML();
  document.getElementById('success-screen').style.display = 'none';
  document.getElementById('payment-method-section').style.display = 'block';
  document.getElementById('methodSelection').style.display = 'flex';
  selectMethod('card');
  document.getElementById('shipping-form').style.display = 'block';
  document.getElementById('main-pay-btn').style.display = 'block';
  document.getElementById('paymentOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  const shipCodeSel = document.getElementById('ship-country-code');
  if (shipCodeSel && shipCodeSel.options.length <= 1) loadCountryCodesForShipping();
}
window.doCheckout = doCheckout;

function buildOrderSummaryHTML() {
  let html = `<div style="font-size:0.9rem;line-height:1.5;">`;
  cart.forEach(item => {
    html += `<div style="display:flex;justify-content:space-between;margin:4px 0;color:var(--n700);">
      <div>${item.name} <small>(${item.colour}, Size ${item.size})</small> <strong>×${item.qty}</strong></div>
      <div>₹${(item.price * item.qty).toFixed(2)}</div></div>`;
  });
  html += `</div><hr style="margin:12px 0;border:none;border-top:1px dashed var(--n200);">
    <div style="display:flex;justify-content:space-between;font-weight:600;color:var(--n900);">
      <div>Total</div><div>₹${orderTotal.toFixed(2)}</div></div>`;
  return html;
}

function selectMethod(method) {
  currentMethod = method;
  document.querySelectorAll('#methodSelection .filter-tab').forEach(b => b.classList.remove('active'));
  const tab = document.getElementById(`tab-${method}`);
  if (tab) tab.classList.add('active');
  document.getElementById('card-form').style.display = 'none';
  document.getElementById('upi-form').style.display = 'none';
  document.getElementById('cod-form').style.display = 'none';
  if (method === 'card') document.getElementById('card-form').style.display = 'flex';
  else if (method === 'upi') { document.getElementById('upi-form').style.display = 'flex'; generateUPIQR(); startUpiTimer(); }
  else if (method === 'cod') document.getElementById('cod-form').style.display = 'flex';
  else clearInterval(upiTimerInterval);
}
window.selectMethod = selectMethod;

// ════════════ EMAIL VALIDATION (FIXED) ════════════
async function validateEmailFormat() {
  const email = document.getElementById('ship-email').value.trim();
  const statusEl = document.getElementById('email-status');
  
  if (!email) { 
    statusEl.className = 'zip-status'; 
    statusEl.textContent = ''; 
    return false; 
  }
  
  // LAYER 1: Strict Regex - blocks nj@g.c
  const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    statusEl.className = 'zip-status'; 
    statusEl.style.color = '#e53e3e';
    statusEl.textContent = ' Invalid email format'; 
    isEmailVerified = false; 
    return false;
  }
  
  const domain = email.split('@')[1].toLowerCase();
  statusEl.className = 'zip-status checking'; 
  statusEl.style.color = '';
  statusEl.textContent = 'Verifying...';
  
  // LAYER 2: Check disposable
  try {
    const res = await fetch(`https://open.kickbox.com/v1/disposable/${domain}`);
    const data = await res.json();
    if (data.disposable) {
      statusEl.className = 'zip-status'; 
      statusEl.style.color = '#e53e3e';
      statusEl.textContent = ' Temporary emails not allowed'; 
      isEmailVerified = false; 
      return false;
    }
  } catch (err) { }
  
  // LAYER 3: AbstractAPI
  try {
    const abstractCheck = await verifyEmailViaAbstract(email);
    if (!abstractCheck.valid) {
      statusEl.className = 'zip-status'; 
      statusEl.style.color = '#e53e3e';
      statusEl.textContent = `✗ ${abstractCheck.error}`; 
      isEmailVerified = false; 
      return false;
    }
  } catch (err) {
    console.warn('AbstractAPI error:', err);
  }
  
  // All checks passed - generate OTP
  generatedEmailOTP = Math.floor(100000 + Math.random() * 900000).toString();
  isEmailVerified = false; // Must verify with OTP
  
  document.getElementById('email-otp-group').style.display = 'flex';
  showToast(`📧 OTP: ${generatedEmailOTP}`);
  statusEl.textContent = `✓ Enter OTP: ${generatedEmailOTP}`;
  statusEl.className = 'zip-status ok'; 
  statusEl.style.color = '';
  
  return true;
}

async function verifyEmailViaAbstract(email) {
  try {
    const res = await fetch(`https://emailvalidation.abstractapi.com/v1/?api_key=${ABSTRACT_API_KEY}&email=${encodeURIComponent(email)}`);
    const data = await res.json();

    if (data.deliverability === "UNDELIVERABLE") {
      return { valid: false, error: "This email does not exist" };
    }
    if (data.is_disposable_email && data.is_disposable_email.value) {
      return { valid: false, error: "Disposable emails not accepted" };
    }
    if (data.is_role_email && data.is_role_email.value) {
      return { valid: false, error: "Role-based emails not accepted" };
    }

    return { valid: true };
  } catch (err) {
    return { valid: true };
  }
}

function verifyEmailOTP() {
  const inputOTP = document.getElementById('email-otp').value.trim();
  const statusEl = document.getElementById('email-otp-status');
  
  if (!inputOTP) {
    statusEl.className = 'zip-status';
    statusEl.style.color = '#e53e3e';
    statusEl.textContent = '✗ Enter OTP';
    isEmailVerified = false;
    return false;
  }
  
  if (inputOTP === generatedEmailOTP) {
    statusEl.className = 'zip-status ok';
    statusEl.style.color = '';
    statusEl.textContent = '✓ Email verified successfully';
    isEmailVerified = true; // ✅ SET TO TRUE
    document.getElementById('email-otp-group').style.display = 'none';
    showToast('✅ Email verified!');
    return true;
  } else {
    statusEl.className = 'zip-status';
    statusEl.style.color = '#e53e3e';
    statusEl.textContent = ' Invalid OTP. Try again.';
    isEmailVerified = false; // ❌ SET TO FALSE
    return false;
  }
}
window.validateEmailFormat = validateEmailFormat;
window.verifyEmailOTP = verifyEmailOTP;

// ── PHONE VALIDATION
function validatePhone() {
  const phoneInput = document.getElementById('ship-phone').value.trim();
  const countryCodeSelect = document.getElementById('ship-country-code');
  const statusEl = document.getElementById('phone-status');
  if (!phoneInput) {
    statusEl.className = 'zip-status'; statusEl.textContent = '';
    return false;
  }
  const selectedOption = countryCodeSelect.options[countryCodeSelect.selectedIndex];
  const iso2 = selectedOption.getAttribute('data-iso2') || 'IN';
  const countryName = selectedOption.getAttribute('data-country') || 'India';
  try {
    const phoneNumber = libphonenumber.parsePhoneNumber(phoneInput, iso2);
    if (phoneNumber && phoneNumber.isValid()) {
      statusEl.className = 'zip-status ok';
      statusEl.style.color = '';
      statusEl.textContent = `✓ Valid ${countryName} number`;
      return true;
    } else {
      statusEl.className = 'zip-status';
      statusEl.style.color = '#e53e3e';
      statusEl.textContent = `✗ Invalid number`;
      return false;
    }
  } catch (e) {
    statusEl.className = 'zip-status';
    statusEl.style.color = '#e53e3e';
    statusEl.textContent = ' Invalid format';
    return false;
  }
}
window.validatePhone = validatePhone;

// ── ZIP VALIDATION
async function onZipInput() {
  const zip = document.getElementById('ship-zip').value.trim();
  const statusEl = document.getElementById('zip-status');
  const cityInput = document.getElementById('ship-city');
  const stateInput = document.getElementById('ship-state');
  const myToken = ++zipCheckToken;
  
  if (!zip) { statusEl.className = 'zip-status'; statusEl.textContent = ''; return; }
  statusEl.className = 'zip-status checking'; statusEl.style.color = '';
  statusEl.textContent = 'Checking...';
  
  const result = await checkZip(zip);
  if (myToken !== zipCheckToken) return;
  
  if (result.ok) {
    statusEl.className = 'zip-status ok'; statusEl.style.color = '';
    statusEl.textContent = `✓ ${result.place}`;
    if (result.city && cityInput) cityInput.value = result.city;
    if (result.state && stateInput) stateInput.value = result.state;
  } else {
    statusEl.className = 'zip-status'; statusEl.style.color = '#e53e3e';
    statusEl.textContent = `✗ ${result.error}`;
  }
}
window.onZipInput = onZipInput;

async function checkZip(zip) {
  const country = getSelectedCountryForShipping();
  if (!zip || zip.length < 3) return { ok: false, error: 'Too short' };
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    let response;
    
    if (country.iso2 === 'IN') {
      response = await fetch(`https://api.postalpincode.in/pincode/${zip}`, { signal: controller.signal });
    } else {
      response = await fetch(`https://api.zippopotam.us/${country.iso2.toLowerCase()}/${zip}`, { signal: controller.signal });
    }
    
    clearTimeout(timeoutId);
    if (!response.ok) return { ok: false, error: 'Not found' };
    
    const data = await response.json();
    if (country.iso2 === 'IN') {
      if (data[0] && data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
        const office = data[0].PostOffice[0];
        return { ok: true, place: `${office.Name}, ${office.District}`, city: office.District, state: office.State };
      }
      return { ok: false, error: 'PIN not found' };
    } else {
      if (data.places && data.places.length > 0) {
        const place = data.places[0];
        return { ok: true, place: `${place['place name']}, ${place['state abbreviation']}`, city: place['place name'], state: place['state'] };
      }
      return { ok: false, error: 'ZIP not found' };
    }
  } catch (error) {
    return { ok: false, error: 'Unable to verify' };
  }
}
window.checkZip = checkZip;

function getSelectedCountryForShipping() {
  const sel = document.getElementById('ship-country-code');
  if (!sel) return { name: 'India', iso2: 'IN', dial: '+91' };
  const opt = sel.options[sel.selectedIndex];
  return { name: opt.getAttribute('data-country') || 'India', iso2: opt.getAttribute('data-iso2') || 'IN', dial: sel.value };
}

// ─ CARD VALIDATION
const CARD_NETWORKS = [
  { id: 'visa', label: 'VISA', length: [16, 18, 19], test: n => /^4/.test(n) },
  { id: 'mastercard', label: 'Mastercard', length: [16], test: n => /^5[1-5]/.test(n) },
  { id: 'rupay', label: 'RuPay', length: [16], test: n => /^60/.test(n) },
  { id: 'amex', label: 'Amex', length: [15], test: n => /^3[47]/.test(n) }
];

function luhnValid(num) {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = parseInt(num.charAt(i), 10);
    if (alt) { d *= 2; if (d > 9) d -= 9; }
    sum += d; alt = !alt;
  }
  return num.length > 0 && sum % 10 === 0;
}

function detectCardBrand(digits) {
  for (const net of CARD_NETWORKS) { if (net.test(digits)) return net; }
  return null;
}

function onCardNumberInput(input) {
  let digits = input.value.replace(/\D/g, '').slice(0, 19);
  const net = detectCardBrand(digits);
  const maxLen = net ? Math.max(...net.length) : 19;
  digits = digits.slice(0, maxLen);
  input.value = digits.replace(/(\d{4})/g, '$1 ').trim();
  const badge = document.getElementById('card-brand-badge');
  const hint = document.getElementById('card-brand-hint');
  badge.className = 'card-brand-badge';
  if (digits.length < 4) {
    badge.textContent = 'Detecting…';
    hint.textContent = "We accept Visa, Mastercard, RuPay, and Amex.";
    return;
  }
  if (net) {
    badge.textContent = net.label;
    badge.classList.add(net.id);
    hint.textContent = `${net.label} detected.`;
  } else {
    badge.textContent = 'Unknown';
  }
}
window.onCardNumberInput = onCardNumberInput;

function validateCardFormLocal() {
  const errorBox = document.getElementById('card-error');
  errorBox.style.display = 'none';
  const rawNumber = document.getElementById('card-number').value.replace(/\D/g, '');
  const name = document.getElementById('card-name').value.trim();
  const expMonth = document.getElementById('card-exp-month').value;
  const expYear = document.getElementById('card-exp-year').value.trim();
  const cvc = document.getElementById('card-cvc').value.trim();
  const net = detectCardBrand(rawNumber);
  
  if (!rawNumber || rawNumber.length < 13) { errorBox.innerText = "Card number incomplete"; errorBox.style.display = 'block'; return false; }
  if (net && !net.length.includes(rawNumber.length)) { errorBox.innerText = "Invalid card length"; errorBox.style.display = 'block'; return false; }
  if (!luhnValid(rawNumber)) { errorBox.innerText = "Invalid card number"; errorBox.style.display = 'block'; return false; }
  if (!name) { errorBox.innerText = "Name required"; errorBox.style.display = 'block'; return false; }
  if (!expMonth || !/^\d{4}$/.test(expYear)) { errorBox.innerText = "Invalid expiry"; errorBox.style.display = 'block'; return false; }
  const now = new Date();
  const expDate = new Date(parseInt(expYear, 10), parseInt(expMonth, 10), 0);
  if (expDate < now) { errorBox.innerText = "Card expired"; errorBox.style.display = 'block'; return false; }
  const cvcLen = (net && net.id === 'amex') ? 4 : 3;
  if (!new RegExp(`^\\d{${cvcLen}}$`).test(cvc)) { errorBox.innerText = "Invalid CVC"; errorBox.style.display = 'block'; return false; }
  return true;
}

// ── RAZORPAY INTEGRATION
function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Razorpay SDK failed to load'));
    document.body.appendChild(script);
  });
}

// ── PROCESS PAYMENT (DUAL ERROR DISPLAY)
async function processPayment() {
  const btn = document.getElementById('main-pay-btn');
  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.textContent = 'Processing…';
  const errorBox = document.getElementById('shipping-error');
  errorBox.style.display = 'none';
  
  const name = document.getElementById('ship-name').value.trim();
  const email = document.getElementById('ship-email').value.trim();
  const phone = document.getElementById('ship-phone').value.trim();
  const address = document.getElementById('ship-address').value.trim();
  const city = document.getElementById('ship-city').value.trim();
  const state = document.getElementById('ship-state').value.trim();
  const zip = document.getElementById('ship-zip').value.trim();
  
  // 1. Check all fields filled
  if (!name || !email || !phone || !address || !city || !state || !zip) {
    const errorMsg = "Please fill all fields";
    errorBox.innerText = errorMsg;
    errorBox.style.display = 'block'; 
    showToast('❌ ' + errorMsg);
    btn.disabled = false; 
    btn.textContent = originalLabel; 
    return;
  }
  
  // 2. VALIDATE EMAIL FORMAT (Shows below email field AND below button)
  const emailStatusEl = document.getElementById('email-status');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    const errorMsg = "Invalid email format";
    emailStatusEl.className = 'zip-status'; 
    emailStatusEl.style.color = '#e53e3e';
    emailStatusEl.textContent = '✗ ' + errorMsg; 
    errorBox.innerText = errorMsg;
    errorBox.style.display = 'block';
    isEmailVerified = false;
    btn.disabled = false; 
    btn.textContent = originalLabel; 
    return;
  }
  
  // 3. Check if email is verified
  if (!isEmailVerified) {
    const errorMsg = "Please verify email with OTP";
    emailStatusEl.className = 'zip-status'; 
    emailStatusEl.style.color = '#e53e3e';
    emailStatusEl.textContent = '✗ ' + errorMsg; 
    errorBox.innerText = errorMsg;
    errorBox.style.display = 'block';
    btn.disabled = false; 
    btn.textContent = originalLabel; 
    return;
  }
  
  // 4. Validate Phone
  if (!validatePhone()) {
    const errorMsg = "Invalid phone number";
    errorBox.innerText = errorMsg;
    errorBox.style.display = 'block'; 
    showToast('❌ ' + errorMsg);
    btn.disabled = false; 
    btn.textContent = originalLabel; 
    return;
  }
  
  // 5. Validate ZIP
  const zipResult = await checkZip(zip);
  if (!zipResult.ok) {
    const errorMsg = "Invalid ZIP code";
    errorBox.innerText = errorMsg;
    errorBox.style.display = 'block'; 
    showToast('❌ ' + errorMsg);
    btn.disabled = false; 
    btn.textContent = originalLabel; 
    return;
  }
  
  // 6. Validate Card (if card method)
  if (currentMethod === 'card' && !validateCardFormLocal()) {
    btn.disabled = false; 
    btn.textContent = originalLabel; 
    return;
  }
  
  const countrySel = document.getElementById('ship-country-code');
  const countryOpt = countrySel.options[countrySel.selectedIndex];
  const shippingData = {
    name, email,
    phone: countrySel.value + phone,
    address, city, state, zip,
    country: countryOpt.getAttribute('data-country') || ''
  };

  // RAZORPAY PAYMENT
  if (currentMethod === 'card' || currentMethod === 'upi') {
    try {
      await loadRazorpayScript();
      
      const options = {
        key: RAZORPAY_KEY_ID,
        amount: Math.round(orderTotal * 100),
        currency: "INR",
        name: "Ovena Health",
        description: "Juzo Compression Socks",
        handler: function(response) {
          // ✅ RAZORPAY SUCCESS - Save order and show success screen
          finalizeOrder(response.razorpay_payment_id, shippingData);
        },
        prefill: {
          name: shippingData.name,
          email: shippingData.email,
          contact: shippingData.phone.replace(/\D/g, '')
        },
        theme: { color: "#1B2A4A" },
        modal: {
          ondismiss: function() {
            btn.disabled = false;
            btn.textContent = originalLabel;
          }
        }
      };
      
      const rzp = new Razorpay(options);
      rzp.open();
      return;
      
    } catch (err) {
      console.error("Razorpay Error:", err);
      const errorMsg = "Payment gateway error. Please try again.";
      errorBox.innerText = errorMsg;
      errorBox.style.display = 'block';
      showToast(' ' + errorMsg);
      btn.disabled = false;
      btn.textContent = originalLabel;
      return;
    }
  }

  // COD FALLBACK
  showToast('Processing COD order...');
  await new Promise(r => setTimeout(r, 1500));
  btn.disabled = false;
  btn.textContent = originalLabel;
  finalizeOrder('COD_' + Math.random().toString(36).substr(2, 9), shippingData);
}

function finalizeOrder(paymentId, shippingData) {
  clearInterval(upiTimerInterval);
  ['payment-method-section', 'card-form', 'upi-form', 'cod-form', 'shipping-form', 'main-pay-btn']
    .forEach(id => document.getElementById(id).style.display = 'none');
  
  const orderHash = Math.floor(Math.random() * 899999) + 100000;
  
  const orderData = {
    'Timestamp': new Date().toLocaleString(),
    'Order ID': `OV-${orderHash}`,
    'Payment ID': paymentId,
    'Name': shippingData.name,
    'Email': shippingData.email,
    'Phone': shippingData.phone,
    'Address': shippingData.address,
    'City': shippingData.city,
    'State': shippingData.state,
    'Zip': shippingData.zip,
    'Country': shippingData.country,
    'Payment Method': currentMethod.toUpperCase(),
    'Total': `₹${orderTotal.toFixed(2)}`,
    'Items': cart.map(i => `${i.name} (${i.colour}, Sz ${i.size}) x${i.qty}`).join(' | ')
  };
  
  saveOrderToSheets(orderData);
  
  const itemsHTML = cart.map(item => `
    <div style="display:flex;justify-content:space-between;margin:6px 0;font-size:0.85rem;color:var(--n700);border-bottom:1px solid var(--n100);padding-bottom:6px;">
      <span>${item.name} <small>(${item.colour}, Sz ${item.size})</small> × ${item.qty}</span>
      <span style="font-weight:600;">₹${(item.price * item.qty).toFixed(2)}</span>
    </div>`).join('');
  
  document.getElementById('tracking-details').innerHTML = `
    <div style="text-align:center;margin-bottom:15px;">
      <p style="font-size:0.8rem;color:var(--teal-d);font-weight:600;">ORDER CONFIRMED</p>
      <p style="font-family:'DM Serif Display',serif;font-size:1.4rem;">#OV-${orderHash}</p>
    </div>
    <div style="background:var(--white);padding:12px;border-radius:8px;border:1px solid var(--n100);margin-bottom:15px;">
      <p style="font-size:0.75rem;font-weight:600;color:var(--n400);text-transform:uppercase;margin-bottom:8px;">Items</p>
      ${itemsHTML}
      <div style="display:flex;justify-content:space-between;margin-top:10px;font-weight:700;color:var(--n900);">
        <span>Total</span><span>₹${orderTotal.toFixed(2)}</span>
      </div>
    </div>
    <div style="background:var(--n50);padding:12px;border-radius:8px;">
      <p style="font-size:0.75rem;font-weight:600;color:var(--n400);text-transform:uppercase;margin-bottom:8px;"> Shipping To</p>
      <p style="line-height:1.6;font-size:0.85rem;color:var(--n700);margin:0;">
        ${shippingData.name}<br>${shippingData.email}<br>${shippingData.phone}<br>
        ${shippingData.address}<br>${shippingData.city}, ${shippingData.state} ${shippingData.zip}<br>${shippingData.country}
      </p>
    </div>`;
  
  document.getElementById('success-screen').style.display = 'block';
  cart = []; updateCartBadge(); renderCart();
}
window.processPayment = processPayment;

function closePayment() {
  document.getElementById('paymentOverlay').classList.remove('open');
  document.body.style.overflow = '';
  clearInterval(upiTimerInterval);
  isEmailVerified = false;
  generatedEmailOTP = null;
}
window.closePayment = closePayment;

// ─ UPI FUNCTIONS
function generateUPIQR() {
  const validationURI = `upi://pay?pa=merchant@ovena&pn=OvenaHealth&am=${orderTotal}&cu=INR`;
  document.getElementById('upi-qr').src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(validationURI)}`;
}
window.generateUPIQR = generateUPIQR;

function startUpiTimer() {
  clearInterval(upiTimerInterval);
  let secondsLeft = 300;
  const el = document.getElementById('upi-timer-val');
  const render = () => { if (el) el.textContent = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`; };
  render();
  upiTimerInterval = setInterval(() => { secondsLeft--; if (secondsLeft <= 0) { clearInterval(upiTimerInterval); generateUPIQR(); secondsLeft = 300; } render(); }, 1000);
}

// ── COUNTRY CODES
async function loadCountryCodesForShipping() {
  const select = document.getElementById('ship-country-code');
  const countryInput = document.getElementById('ship-country');
  if (!select || !countryInput) return;
  
  const fallback = [
    { name: 'India', code: '+91', iso2: 'IN' },
    { name: 'United States', code: '+1', iso2: 'US' },
    { name: 'United Kingdom', code: '+44', iso2: 'GB' },
    { name: 'United Arab Emirates', code: '+971', iso2: 'AE' }
  ];
  
  select.innerHTML = '';
  fallback.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.setAttribute('data-country', c.name);
    opt.setAttribute('data-iso2', c.iso2);
    opt.textContent = `${c.name} (${c.code})`;
    select.appendChild(opt);
  });
  
  select.value = '+91';
  countryInput.value = 'India';
  select.addEventListener('change', function() {
    const selected = this.options[this.selectedIndex];
    countryInput.value = selected.getAttribute('data-country');
  });
}

// ── TOAST
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4000);
}

// ─ GOOGLE SHEETS
async function saveOrderToSheets(orderData) {
  if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL.includes('PASTE_YOUR')) return false;
  try {
    await fetch(GOOGLE_SHEETS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(orderData) });
    console.log('✓ Order saved');
    return true;
  } catch (err) { 
    console.error('Save failed:', err);
    return false; 
  }
}

// ─ INIT
function initExpiryMonths() {
  const sel = document.getElementById('card-exp-month');
  if (!sel) return;
  for (let m = 1; m <= 12; m++) {
    const opt = document.createElement('option');
    opt.value = String(m).padStart(2, '0');
    opt.textContent = String(m).padStart(2, '0');
    sel.appendChild(opt);
  }
}
initExpiryMonths();