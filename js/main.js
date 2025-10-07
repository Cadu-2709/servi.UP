import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, collection, onSnapshot, addDoc, setDoc, deleteDoc, getDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBgC0DSPAeEhhybKqHJeSibCtM9DUMKZOM",
    authDomain: "edilson-7b5e4.firebaseapp.com",
    projectId: "edilson-7b5e4",
    storageBucket: "edilson-7b5e4.appspot.com",
    messagingSenderId: "1017782257434",
    appId: "1:1017782257434:web:ca7d5ec3dcdc5bee364ea3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let userId, userSettings = {}, clientsCol, budgetsCol, expensesCol;
let clients = [], budgets = [], expenses = [], services = [], products = [];
let currentStatusFilter = 'all', currentPeriodFilter = 'month';

const loginView = document.getElementById('view-login');
const mainContent = document.getElementById('main-content');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        userId = user.uid;
        await loadUserSettings();
        mainContent.classList.remove('hidden');
        loginView.classList.remove('active');
        document.getElementById('view-loading').classList.remove('active');
        setupListeners();
        showView('view-dashboard');
    } else {
        mainContent.classList.add('hidden');
        document.getElementById('view-loading').classList.remove('active');
        showAuthView('view-login');
    }
});

function showAuthView(viewId) {
    document.querySelectorAll('#app-container > .view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function setupListeners() {
    clientsCol = collection(db, 'users', userId, 'clients');
    budgetsCol = collection(db, 'users', userId, 'budgets');
    expensesCol = collection(db, 'users', userId, 'expenses');

    onSnapshot(clientsCol, (snapshot) => {
        clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        clients.sort((a, b) => a.name.localeCompare(b.name));
        if (document.getElementById('view-clients-list').classList.contains('active')) renderClientsList(clients);
        updateClientDropdown();
    });

    onSnapshot(budgetsCol, (snapshot) => {
        budgets = snapshot.docs.map(doc => { const data = doc.data(); if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate(); if (data.scheduledAt?.toDate) data.scheduledAt = data.scheduledAt.toDate(); if (data.completedAt?.toDate) data.completedAt = data.completedAt.toDate(); if (data.paidAt?.toDate) data.paidAt = data.paidAt.toDate(); return { id: doc.id, ...data }; });
        budgets.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        if (document.getElementById('view-budgets-list').classList.contains('active')) renderBudgets();
        if (document.getElementById('view-reports').classList.contains('active')) renderReports();
        if (document.getElementById('view-dashboard').classList.contains('active')) updateNextAppointmentCard();
        if (document.getElementById('view-client-form').classList.contains('active')) {
            const currentClientId = document.getElementById('client-id').value;
            if (currentClientId) renderClientHistory(currentClientId);
        }
    });

    onSnapshot(expensesCol, (snapshot) => {
        expenses = snapshot.docs.map(doc => { const data = doc.data(); if (data.date?.toDate) data.date = data.date.toDate(); return { id: doc.id, ...data }; });
        if (document.getElementById('view-expenses-list').classList.contains('active')) renderExpensesList(expenses);
        if (document.getElementById('view-reports').classList.contains('active')) renderReports();
    });
}

const formatCurrency = (value) => {
    if (typeof value !== 'number') return 'R$ 0,00';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

async function loadUserSettings() {
    if (!userId) return;
    const settingsDocRef = doc(db, `users/${userId}/settings/profile`);
    const docSnap = await getDoc(settingsDocRef);
    userSettings = docSnap.exists() ? docSnap.data() : {
        companyName: 'Sua Empresa',
        cnpj: '',
        address: '',
        phone: 'Seu Telefone',
        logoUrl: 'https://placehold.co/200x100/cccccc/ffffff?text=Logo',
        primaryColor: 'green'
    };
    applySettings();
}

function applySettings() {
    document.getElementById('logo-main').src = userSettings.logoUrl;
    applyThemeColor(userSettings.primaryColor);
}

function applyThemeColor(colorName) {
    const themes = {
        'green': { base: '#1de224', hover: '#18b91d', bordaLeve: '#b9f5bb' },
        'indigo': { base: '#4f46e5', hover: '#4338ca', bordaLeve: '#c7d2fe' },
        'red': { base: '#ef4444', hover: '#dc2626', bordaLeve: '#fecaca' },
        'sky': { base: '#0ea5e9', hover: '#0284c7', bordaLeve: '#bae6fd' }
    };
    const activeTheme = themes[colorName] || themes['green'];
    const root = document.documentElement;
    root.style.setProperty('--cor-primaria', activeTheme.base);
    root.style.setProperty('--cor-primaria-hover', activeTheme.hover);
    root.style.setProperty('--cor-texto-primaria', activeTheme.base);
    root.style.setProperty('--cor-borda-primaria-leve', activeTheme.bordaLeve);
}

function showToolsMenu() {
    document.getElementById('tools-menu').classList.remove('hidden');
    document.getElementById('tool-content-wrapper').classList.add('hidden');
    document.querySelectorAll('.tool-content').forEach(tool => tool.classList.add('hidden'));
}

function showTool(toolName) {
    if (toolName === 'calculator') {
        document.getElementById('calc-percent').value = '';
        document.getElementById('calc-valor').value = '';
        document.getElementById('calc-resultado').innerHTML = '';
    } else if (toolName === 'pix') {
        document.getElementById('pix-valor').value = '';
        document.getElementById('pix-id').value = '';
        document.getElementById('pix-result-container').classList.add('hidden');
    } else if (toolName === 'marketing') {
        document.getElementById('image-upload').value = '';
        const canvas = document.getElementById('image-canvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        document.getElementById('preview-container').classList.add('hidden');
        const downloadBtn = document.getElementById('download-btn');
        downloadBtn.classList.add('bg-gray-400', 'pointer-events-none', 'opacity-50');
        downloadBtn.classList.remove('bg-[var(--cor-primaria)]', 'hover:bg-[var(--cor-primaria-hover)]');
        downloadBtn.removeAttribute('href');
    }
    
    document.getElementById('tools-menu').classList.add('hidden');
    document.getElementById('tool-content-wrapper').classList.remove('hidden');
    document.getElementById(`tool-${toolName}`).classList.remove('hidden');
}

function showView(viewId, id = null, clientId = null) {
    document.querySelectorAll('#main-content .view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    if (viewId === 'view-client-form') prepareClientForm(clientId);
    if (viewId === 'view-budget-form') prepareBudgetForm(id);
    if (viewId === 'view-expense-form') prepareExpenseForm(id);
    if (viewId === 'view-clients-list') renderClientsList(clients);
    if (viewId === 'view-budgets-list') renderBudgets();
    if (viewId === 'view-reports') renderReports();
    if (viewId === 'view-expenses-list') renderExpensesList(expenses);
    if (viewId === 'view-dashboard') {
        applySettings();
        updateNextAppointmentCard();
    }
    if (viewId === 'view-tools') { 
        showToolsMenu(); 
    }
}

function renderClientsList(clientsToRender) {
    const container = document.getElementById('clients-list-container');
    const template = document.getElementById('template-cliente');
    container.innerHTML = '';
    if (clientsToRender.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 mt-8">Nenhum cliente encontrado.</p>`;
        return;
    }
    clientsToRender.forEach(client => {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('div');
        card.dataset.clientId = client.id;
        card.querySelector('.nome-cliente').textContent = client.name;
        card.querySelector('.telefone-cliente').textContent = client.phone || 'Sem telefone';
        container.appendChild(clone);
    });
}

function prepareClientForm(clientId) {
    const form = document.getElementById('client-form');
    form.reset();
    const deleteBtn = document.getElementById('delete-client-btn');
    const historyContainer = document.getElementById('client-history-container');
    const toggleBtn = document.getElementById('toggle-history-btn');
    if (clientId) {
        const client = clients.find(c => c.id === clientId);
        if (client) {
            document.getElementById('client-form-title').textContent = 'Editar Cliente';
            document.getElementById('client-id').value = client.id;
            form['client-name'].value = client.name;
            form['client-phone'].value = client.phone || '';
            form['client-data'].value = client.data || '';
            deleteBtn.classList.remove('hidden');
            toggleBtn.classList.remove('hidden');
            renderClientHistory(clientId);
        }
    } else {
        document.getElementById('client-form-title').textContent = 'Novo Cliente';
        document.getElementById('client-id').value = '';
        deleteBtn.classList.add('hidden');
        toggleBtn.classList.add('hidden');
        historyContainer.innerHTML = '';
        historyContainer.classList.add('hidden');
    }
}

function renderClientHistory(clientId) {
    const container = document.getElementById('client-history-container');
    const template = document.getElementById('template-historico-orcamento');
    const clientBudgets = budgets.filter(b => b.clientId === clientId);
    
    container.innerHTML = '';
    if (clientBudgets.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500">Nenhum orçamento para este cliente.</p>';
        return;
    }
    clientBudgets.forEach(budget => {
        const clone = template.content.cloneNode(true);
        const statusInfo = getStatusInfo(budget.status);
        
        clone.querySelector('.budget-history-item').dataset.id = budget.id;
        clone.querySelector('.pdf-budget-btn').dataset.id = budget.id;
        clone.querySelector('.titulo-orcamento').textContent = budget.title || `Orçamento`;
        
        const statusEl = clone.querySelector('.status-orcamento');
        statusEl.textContent = statusInfo.label;
        statusEl.className = `status-orcamento px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.bgColor} ${statusInfo.textColor}`;
        
        const datasContainer = clone.querySelector('.datas-container');
        let dateInfoHTML = `<p class="text-xs text-gray-500">${budget.createdAt.toLocaleDateString('pt-BR')}</p>`;
        if (budget.status === 'paid' && budget.paidAt) {
            dateInfoHTML += `<p class="text-xs text-green-600 font-semibold">Pago em: ${budget.paidAt.toLocaleDateString('pt-BR')}</p>`;
        }
        datasContainer.innerHTML = dateInfoHTML;

        container.appendChild(clone);
    });
}

function renderBudgets() {
    const container = document.getElementById('budgets-list-container');
    const template = document.getElementById('template-orcamento');
    const searchTerm = document.getElementById('budget-search-input').value.toLowerCase();
    const statusFilter = document.querySelector('#budget-filters .bg-\\[var\\(--cor-primaria\\)\\]').dataset.status;

    let filtered = budgets.filter(b => b.status !== 'paid');

    if (statusFilter !== 'all') {
        filtered = filtered.filter(b => b.status === statusFilter);
    }

    if (searchTerm) {
        filtered = filtered.filter(budget =>
            (budget.title && budget.title.toLowerCase().includes(searchTerm)) ||
            (budget.clientName && budget.clientName.toLowerCase().includes(searchTerm))
        );
    }
    
    container.innerHTML = '';
    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 mt-8">Nenhum orçamento encontrado.</p>`;
        return;
    }

    filtered.forEach(budget => {
        const clone = template.content.cloneNode(true);
        const client = clients.find(c => c.id === budget.clientId);
        const clientName = client?.name || budget.clientName || 'Cliente';
        const statusInfo = getStatusInfo(budget.status);

        clone.querySelector('.titulo-orcamento').textContent = budget.title || 'Orçamento sem título';
        clone.querySelector('.nome-cliente').textContent = clientName;
        clone.querySelector('.valor-total').textContent = formatCurrency(budget.totalAmount);

        const dataAgendamentoEl = clone.querySelector('.data-agendamento');
        if (budget.status === 'scheduled' && budget.scheduledAt) {
            dataAgendamentoEl.textContent = budget.scheduledAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
        } else {
            dataAgendamentoEl.remove();
        }
        
        const statusEl = clone.querySelector('.status-orcamento');
        statusEl.textContent = statusInfo.label;
        statusEl.className = `status-orcamento px-2 py-1 text-xs font-semibold rounded-full ${statusInfo.bgColor} ${statusInfo.textColor}`;

        clone.querySelector('.edit-budget-btn').dataset.id = budget.id;
        clone.querySelector('.pdf-budget-btn').dataset.id = budget.id;
        clone.querySelector('.status-budget-btn').dataset.id = budget.id;

        container.appendChild(clone);
    });
}

function prepareBudgetForm(budgetId) {
    const form = document.getElementById('budget-form');
    form.reset();
    services = []; products = [];
    if (budgetId) {
        const budget = budgets.find(b => b.id === budgetId);
        if (budget) {
            document.getElementById('budget-form-title').textContent = "Editar Orçamento";
            document.getElementById('budget-id').value = budget.id;
            document.getElementById('budget-title').value = budget.title || '';
            document.getElementById('budget-client-id').value = budget.clientId;
            services = budget.services || [];
            products = budget.products || [];
            document.getElementById('total-services-manual').value = budget.totalServicesManual || '';
            document.getElementById('total-products-manual').value = budget.totalProductsManual || '';
            document.querySelector(`input[name="pdf-presentation"][value="${budget.presentation || 'detailed'}"]`).checked = true;
        }
    } else {
        document.getElementById('budget-form-title').textContent = "Novo Orçamento";
        document.getElementById('budget-id').value = '';
    }
    renderItems('service');
    renderItems('product');
    updateTotal();
    document.getElementById('new-client-fields').classList.add('hidden');
}

function updateClientDropdown() {
    const select = document.getElementById('budget-client-id');
    if (!select) return;
    const currentVal = select.value;
    while (select.options.length > 2) {
        select.remove(2);
    }
    clients.forEach(c => {
        const option = new Option(c.name, c.id);
        select.add(option);
    });
    select.value = currentVal;
}

function renderItems(type) {
    const container = document.getElementById(`${type}s-container`);
    const template = document.getElementById('template-item-orcamento');
    const items = type === 'service' ? services : products;
    
    container.innerHTML = '';
    items.forEach((item, index) => {
        const clone = template.content.cloneNode(true);
        const itemDiv = clone.querySelector('div');
        itemDiv.dataset.index = index;
        itemDiv.querySelector('.item-desc').value = item.description || '';
        itemDiv.querySelector('.item-qty').value = item.quantity || 1;
        itemDiv.querySelector('.item-val').value = item.value ?? '';
        container.appendChild(clone);
    });
    
    document.getElementById(`${type}s-total-manual-container`).classList.toggle('hidden', items.length > 0);
    updateTotal();
}

function updateTotal() {
    const sManual = parseFloat(document.getElementById('total-services-manual').value), pManual = parseFloat(document.getElementById('total-products-manual').value);
    const sTotal = !isNaN(sManual) ? sManual : services.reduce((s, i) => s + (i.value || 0) * (i.quantity || 1), 0);
    const pTotal = !isNaN(pManual) ? pManual : products.reduce((s, i) => s + (i.value || 0) * (i.quantity || 1), 0);
    document.getElementById('total-budget-amount').textContent = formatCurrency(sTotal + pTotal);
}

async function createAndSharePdf(budgetId) {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget) return;
    const client = clients.find(c => c.id === budget.clientId);
    const clientName = client?.name || budget.clientName;
    const pdfContainer = document.getElementById('pdf-content');
    const showDetailed = budget.presentation === 'detailed';
    const listRow = (item) => `<li class="py-1">${item.quantity}x ${item.description}</li>`;
    const tableRow = (item) => `<tr class="border-b border-gray-200"><td class="py-2 pr-2">${item.quantity}x ${item.description}</td><td class="py-2 text-right">${formatCurrency(item.value * item.quantity)}</td></tr>`;
    const createSection = (title, items) => {
        if (!items || items.length === 0) return '';
        const itemsHtml = showDetailed ? `<thead><tr class="text-left text-gray-500"><th class="w-4/5 pb-1">${title}</th><th class="pb-1 text-right">Valor</th></tr></thead><tbody>${items.map(tableRow).join('')}</tbody>` : `<ul>${items.map(listRow).join('')}</ul>`;
        return `<h3 class="text-xl font-bold mt-8 mb-2">${title}</h3><table class="w-full text-sm">${itemsHtml}</table>`;
    };
    pdfContainer.innerHTML = `<div class="p-10 font-sans"><header class="flex justify-between items-center mb-10">
<div class="flex-shrink-0">
<img id="pdf-logo" src="${userSettings.logoUrl}" class="h-20 object-contain" crossorigin="anonymous">
</div>
<div class="text-right flex-grow">
<h1 class="text-sm font-bold text-gray-800 mb-0">${userSettings.cnpj || ''}</h1>
<p class="text-sm text-gray-600">${userSettings.address || ''}</p>
<p class="text-sm text-gray-600">Data: ${budget.createdAt.toLocaleDateString('pt-BR')}</p>
</div>
</header><div class="border border-gray-300 p-4 rounded-md mb-8"><p class="font-bold text-gray-800">Cliente: ${clientName}</p><p class="text-gray-600">${client?.phone || ''}</p></div><h2 class="text-center text-2xl font-bold text-gray-800 my-8">PROPOSTA</h2><div class="border border-gray-300 p-6 rounded-md">${createSection('Produtos', budget.products)}${createSection('Serviços', budget.services)}</div><div class="mt-12 text-right"><p class="text-gray-600">VALOR TOTAL</p><p class="text-4xl font-bold text-gray-900">${formatCurrency(budget.totalAmount)}</p></div><footer class="mt-16 pt-4 border-t text-center text-xs text-gray-500"><p class="font-semibold">Contato: ${userSettings.phone}</p><p class="mt-1">Proposta válida por 5 dias.</p></footer></div>`;
    
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    const generate = async () => {
        try {
            const canvas = await html2canvas(pdfContainer, { scale: 2, useCORS: true });
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'pt', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth(), pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', 0, 0, pdfWidth, pdfHeight);
            const pdfFile = new File([pdf.output('blob')], `Orçamento-${clientName.replace(/\s/g, '_')}.pdf`, { type: 'application/pdf' });
            if (isMobile && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({ title: `Orçamento ${clientName}`, text: `Olá, ${clientName}! Segue a proposta.`, files: [pdfFile] });
            } else { pdf.save(`Orçamento-${clientName.replace(/\s/g, '_')}.pdf`); }
        } catch (error) { console.error("Erro ao gerar PDF:", error); }
    }

    const logoEl = pdfContainer.querySelector('#pdf-logo');
    if (logoEl.complete) {
        generate();
    } else {
        logoEl.onload = generate;
        logoEl.onerror = generate;
    }
}

function showStatusModal(budgetId) {
    const budget = budgets.find(b => b.id === budgetId);
    if (!budget) return;
    const modal = document.getElementById('modal'), modalContent = document.getElementById('modal-content');
    let content = `<h3 class="text-xl font-bold mb-4">Alterar Status</h3><p class="mb-4">Cliente: <span class="font-semibold">${budget.clientName}</span></p><div class="space-y-2">`;
    if (budget.status === 'pending') content += `<button class="modal-action-btn w-full text-left p-3 bg-gray-100 rounded hover:bg-yellow-100" data-action="schedule" data-id="${budgetId}">Agendar Serviço</button>`;
    if (budget.status === 'scheduled') content += `<button class="modal-action-btn w-full text-left p-3 bg-gray-100 rounded hover:bg-yellow-100" data-action="reschedule" data-id="${budgetId}">Alterar Agendamento</button>`;
    if (budget.status === 'pending' || budget.status === 'scheduled') content += `<button class="modal-action-btn w-full text-left p-3 bg-gray-100 rounded hover:bg-blue-100" data-action="complete" data-id="${budgetId}">Marcar como Concluído</button>`;
    if (budget.status === 'completed') content += `<button class="modal-action-btn w-full text-left p-3 bg-gray-100 rounded hover:bg-green-100" data-action="pay" data-id="${budgetId}">Marcar como Pago</button>`;
    content += `</div><button class="modal-action-btn w-full text-left p-3 mt-4 bg-red-50 text-red-700 rounded hover:bg-red-100" data-action="delete" data-id="${budgetId}">Excluir Orçamento</button><button id="close-modal-btn" class="mt-4 w-full p-2 bg-gray-200 rounded hover:bg-gray-300">Cancelar</button>`;
    modalContent.innerHTML = content;
    modal.classList.remove('hidden');
}

async function handleStatusAction(budgetId, action) {
    const modalContent = document.getElementById('modal-content');
    if (action === 'schedule' || action === 'reschedule') {
        const budget = budgets.find(b => b.id === budgetId), currentSchedule = budget.scheduledAt ? budget.scheduledAt.toISOString().slice(0, 16) : '';
        modalContent.innerHTML = `<h3 class="font-bold mb-2">${action === 'schedule' ? 'Agendar' : 'Alterar'} Serviço</h3><input type="datetime-local" id="schedule-datetime" class="w-full p-2 border rounded" value="${currentSchedule}"><div class="flex gap-2 mt-4"><button id="cancel-schedule" class="w-full p-2 bg-gray-300 rounded">Cancelar</button><button id="confirm-schedule" class="w-full p-2 bg-[var(--cor-primaria)] text-white rounded">Confirmar</button></div>`;
        document.getElementById('confirm-schedule').onclick = async () => {
            const scheduledAt = document.getElementById('schedule-datetime').value;
            if (scheduledAt) { await setDoc(doc(budgetsCol, budgetId), { status: 'scheduled', scheduledAt: Timestamp.fromDate(new Date(scheduledAt)) }, { merge: true }); closeModal(); }
        };
        document.getElementById('cancel-schedule').onclick = () => showStatusModal(budgetId);
    } else if (action === 'complete') { await setDoc(doc(budgetsCol, budgetId), { status: 'completed', completedAt: Timestamp.now() }, { merge: true }); closeModal();
    } else if (action === 'pay') {
        const budget = budgets.find(b => b.id === budgetId);
        modalContent.innerHTML = `<h3 class="font-bold mb-2">Confirmar Pagamento</h3><label for="paid-amount" class="block text-sm">Valor Pago</label><input type="number" step="0.01" id="paid-amount" class="w-full p-2 border rounded" value="${budget.totalAmount}"><div class="flex gap-2 mt-4"><button id="cancel-payment" class="w-full p-2 bg-gray-300 rounded">Cancelar</button><button id="confirm-payment" class="w-full p-2 bg-green-600 text-white rounded">Confirmar</button></div>`;
        document.getElementById('confirm-payment').onclick = async () => {
            const paidAmount = parseFloat(document.getElementById('paid-amount').value);
            if (!isNaN(paidAmount)) { await setDoc(doc(budgetsCol, budgetId), { status: 'paid', paidAt: Timestamp.now(), paidAmount }, { merge: true }); closeModal(); }
        };
        document.getElementById('cancel-payment').onclick = () => showStatusModal(budgetId);
    } else if (action === 'delete') { if (confirm('Tem certeza?')) { await deleteDoc(doc(budgetsCol, budgetId)); closeModal(); } }
}

function closeModal() { document.getElementById('modal').classList.add('hidden'); }

function renderReports() {
    const detailsContainer = document.getElementById('details-list-container');
    const customPeriodFields = document.getElementById('custom-period-fields');
    const activeButton = document.querySelector('#report-filters .bg-\\[var\\(--cor-primaria\\)\\]');
    currentPeriodFilter = activeButton ? activeButton.dataset.period : 'month';

    customPeriodFields.classList.toggle('hidden', currentPeriodFilter !== 'custom');

    let startDate, endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    if (currentPeriodFilter === 'month') { startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1); startDate.setHours(0, 0, 0, 0); }
    else if (currentPeriodFilter === 'week') { startDate = new Date(); startDate.setDate(endDate.getDate() - 6); startDate.setHours(0, 0, 0, 0); }
    else if (currentPeriodFilter === 'custom') {
        const sd = document.getElementById('start-date').value, ed = document.getElementById('end-date').value;
        if (!sd || !ed) return;
        startDate = new Date(sd + "T00:00:00");
        endDate = new Date(ed + "T23:59:59");
    }
    
    if (isNaN(startDate?.getTime()) || isNaN(endDate?.getTime())) return;
    
    const paidBudgets = budgets.filter(b => b.status === 'paid' && b.paidAt >= startDate && b.paidAt <= endDate);
    const totalBilled = paidBudgets.reduce((s, b) => s + (b.paidAmount || 0), 0);
    const periodExpenses = (expenses || []).filter(e => e.date >= startDate && e.date <= endDate);
    const totalExpenses = periodExpenses.reduce((s, e) => s + (e.value || 0), 0);
    
    document.getElementById('report-total-billed').textContent = formatCurrency(totalBilled);
    document.getElementById('report-total-expenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('report-net-profit').textContent = formatCurrency(totalBilled - totalExpenses);

    const transactions = [...paidBudgets.map(b => ({ type: 'receita', date: b.paidAt, description: b.title || 'Orçamento Pago', value: b.paidAmount })), ...periodExpenses.map(e => ({ type: 'despesa', date: e.date, description: e.description, value: e.value }))].sort((a,b) => b.date - a.date);
    
    const template = document.getElementById('template-transacao-relatorio');
    detailsContainer.innerHTML = '';
    if(transactions.length === 0) {
         detailsContainer.innerHTML = '<p class="text-center text-gray-500 mt-4">Nenhuma transação no período.</p>';
    } else {
        transactions.forEach(t => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.descricao-transacao').textContent = t.description;
            clone.querySelector('.data-transacao').textContent = t.date.toLocaleDateString('pt-BR');
            const valorEl = clone.querySelector('.valor-transacao');
            valorEl.textContent = `${t.type === 'receita' ? '+' : '-'} ${formatCurrency(t.value)}`;
            valorEl.classList.add(t.type === 'receita' ? 'text-green-700' : 'text-red-700');
            detailsContainer.appendChild(clone);
        });
    }
}

function updateNextAppointmentCard() {
    const scheduled = budgets.filter(b => b.status === 'scheduled' && b.scheduledAt > new Date()).sort((a,b) => a.scheduledAt - b.scheduledAt);
    const card = document.getElementById('next-appointment-card');
    if (scheduled.length > 0) {
        document.getElementById('next-appointment-details').innerHTML = `<span class="font-bold">${scheduled[0].title || 'Agendamento'}</span> - ${scheduled[0].scheduledAt.toLocaleString('pt-BR', {weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'})}`;
        card.classList.remove('hidden');
    } else { card.classList.add('hidden'); }
}

function getStatusInfo(status) {
    const statuses = { pending: { label: 'Em Aberto', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' }, scheduled: { label: 'Agendado', bgColor: 'bg-blue-100', textColor: 'text-blue-800' }, completed: { label: 'Concluído', bgColor: 'bg-purple-100', textColor: 'text-purple-800' }, paid: { label: 'Pago', bgColor: 'bg-green-100', textColor: 'text-green-800' } };
    return statuses[status] || { label: 'Desconhecido', bgColor: 'bg-gray-100', textColor: 'text-gray-800' };
}

function renderExpensesList(expensesToRender) {
    const container = document.getElementById('expenses-list-container');
    const template = document.getElementById('template-despesa');
    
    container.innerHTML = '';

    if (expensesToRender.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 mt-8">Nenhuma despesa encontrada.</p>`;
        return;
    }

    expensesToRender.sort((a, b) => b.date - a.date).forEach(expense => {
        const clone = template.content.cloneNode(true);
        
        clone.querySelector('.expense-item').dataset.id = expense.id;
        clone.querySelector('.delete-expense-btn').dataset.id = expense.id;
        clone.querySelector('.descricao-despesa').textContent = expense.description;
        clone.querySelector('.data-despesa').textContent = expense.date.toLocaleDateString('pt-BR');
        clone.querySelector('.valor-despesa').textContent = formatCurrency(expense.value);
        
        container.appendChild(clone);
    });
}

function prepareExpenseForm(expenseId) {
    const form = document.getElementById('expense-form');
    form.reset();
    const deleteBtn = document.getElementById('delete-expense-btn');
    if (expenseId) {
        const expense = expenses.find(e => e.id === expenseId);
        if (expense) {
            document.getElementById('expense-form-title').textContent = 'Editar Despesa';
            document.getElementById('expense-id').value = expense.id;
            form['expense-description'].value = expense.description;    
            form['expense-value'].value = expense.value;
            form['expense-date'].valueAsDate = expense.date;
            deleteBtn.classList.remove('hidden');
        }
    } else {
        document.getElementById('expense-form-title').textContent = 'Nova Despesa';
        document.getElementById('expense-id').value = '';
        deleteBtn.classList.add('hidden');
    }
}

document.getElementById('login-form').addEventListener('submit', (e) => { e.preventDefault(); signInWithEmailAndPassword(auth, e.target['login-email'].value, e.target['login-password'].value).catch(err => alert(err.message)); });
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

document.getElementById('app-container').addEventListener('click', (e) => {
    
    const toolBtn = e.target.closest('.tool-menu-btn');
    if (toolBtn) {
        const toolName = toolBtn.dataset.tool;
        showTool(toolName);
        return;
    }

    if (e.target.closest('#tools-back-btn')) {
        const isToolVisible = !document.getElementById('tool-content-wrapper').classList.contains('hidden');
        if (isToolVisible) {
            showToolsMenu();
        } else {
            showView('view-dashboard');
        }
        return;
    }

    const target = e.target.closest('button, div[data-client-id]');
    if (!target) return;

    if (target.matches('.nav-btn')) return showView(target.dataset.view);
    if (target.matches('#add-client-btn')) return showView('view-client-form');
    if (target.matches('#add-expense-btn')) return showView('view-expense-form');
    if (target.matches('.expense-item')) return showView('view-expense-form', target.dataset.id);
    if (target.matches('.budget-history-item')) return showView('view-budget-form', target.dataset.id);
    if (target.matches('[data-client-id]')) return showView('view-client-form', null, target.dataset.clientId);
    
    const budgetActionBtn = target.closest('.edit-budget-btn, .pdf-budget-btn, .status-budget-btn');
    if(budgetActionBtn) {
        const budgetId = budgetActionBtn.dataset.id;
        if (budgetActionBtn.classList.contains('edit-budget-btn')) showView('view-budget-form', budgetId);
        if (budgetActionBtn.classList.contains('pdf-budget-btn')) createAndSharePdf(budgetId);
        if (budgetActionBtn.classList.contains('status-budget-btn')) showStatusModal(budgetId);
        return;
    }

    if (target.matches('.filter-btn-status')) {
        document.querySelectorAll('#budget-filters .filter-btn-status').forEach(b => { 
            b.classList.remove('bg-[var(--cor-primaria)]', 'text-white'); 
            b.classList.add('bg-gray-200'); 
        });
        target.classList.add('bg-[var(--cor-primaria)]', 'text-white');
        target.classList.remove('bg-gray-200');
        renderBudgets();
    }

    if(target.matches('.filter-btn-period')) {
        document.querySelectorAll('#report-filters .filter-btn-period').forEach(b => { 
            b.classList.remove('bg-[var(--cor-primaria)]', 'text-white'); 
            b.classList.add('bg-gray-200'); 
        });
        target.classList.add('bg-[var(--cor-primaria)]', 'text-white');
        target.classList.remove('bg-gray-200');
        renderReports();
    }

    if (target.matches('#delete-client-btn')) {
        const id = document.getElementById('client-id').value;
        if (id && confirm('Tem certeza?')) { deleteDoc(doc(clientsCol, id)).then(() => showView('view-clients-list')); }
    }

    if (target.matches('.delete-expense-btn')) {
        const id = target.dataset.id;
        if (id && confirm('Tem certeza que deseja excluir esta despesa?')) { deleteDoc(doc(expensesCol, id)); }
    }

    if (target.matches('#add-service-btn')) { services.push({ description: '', quantity: 1, value: null }); renderItems('service'); }
    if (target.matches('#add-product-btn')) { products.push({ description: '', quantity: 1, value: null }); renderItems('product'); }
    
    if (target.matches('.remove-item-btn')) {
        const type = target.closest('#services-container') ? 'service' : 'product';
        const index = target.closest('[data-index]').dataset.index;
        (type === 'service' ? services : products).splice(index, 1);
        renderItems(type);
    }

    if(target.matches('#toggle-history-btn')){
        document.getElementById('client-history-container').classList.toggle('hidden');
        target.textContent = target.textContent === 'Ver Histórico de Orçamentos' ? 'Ocultar Histórico' : 'Ver Histórico de Orçamentos';
    }
});

document.getElementById('client-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('client-id').value;
    const clientData = { 
        name: document.getElementById('client-name').value, 
        phone: document.getElementById('client-phone').value,
        data: document.getElementById('client-data').value 
    };
    try { 
        if (id) await setDoc(doc(clientsCol, id), clientData, {merge: true}); 
        else await addDoc(clientsCol, clientData); 
        showView('view-clients-list'); 
    } catch (error) { console.error("Erro ao salvar cliente: ", error); }
});

document.getElementById('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('expense-id').value;
    const expenseData = { 
        description: document.getElementById('expense-description').value,
        value: parseFloat(document.getElementById('expense-value').value), 
        date: Timestamp.fromDate(new Date(document.getElementById('expense-date').value + 'T00:00:00')) 
    };
    try { 
        if (id) await setDoc(doc(expensesCol, id), expenseData, {merge: true}); 
        else await addDoc(expensesCol, expenseData); 
        showView('view-expenses-list'); 
    } catch (error) { console.error("Erro ao salvar despesa: ", error); }
});

document.getElementById('budget-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    let clientId = document.getElementById('budget-client-id').value, clientName = '';
    if (clientId === 'new') {
        const newName = document.getElementById('budget-new-client-name').value;
        if (!newName) return alert('Informe o nome do novo cliente.');
        const newClient = { name: newName, phone: document.getElementById('budget-new-client-phone').value, data: '' };
        const docRef = await addDoc(clientsCol, newClient);
        clientId = docRef.id; clientName = newName;
    } else if (clientId) { clientName = clients.find(c => c.id === clientId)?.name; }
    else { return alert('Selecione um cliente.'); }
    const sManual = document.getElementById('total-services-manual').value ? parseFloat(document.getElementById('total-services-manual').value) : null;
    const pManual = document.getElementById('total-products-manual').value ? parseFloat(document.getElementById('total-products-manual').value) : null;
    const sTotal = sManual ?? services.reduce((s, i) => s + (i.value || 0) * (i.quantity || 1), 0);
    const pTotal = pManual ?? products.reduce((s, i) => s + (i.value || 0) * (i.quantity || 1), 0);
    const totalAmount = sTotal + pTotal;
    const budgetTitle = document.getElementById('budget-title').value;
    const budgetId = document.getElementById('budget-id').value;
    const budgetData = { title: budgetTitle, clientId, clientName, services: services.filter(s => s.description), products: products.filter(p => p.description), totalServicesManual: sManual, totalProductsManual: pManual, totalAmount, presentation: document.querySelector('input[name="pdf-presentation"]:checked').value, updatedAt: Timestamp.now() };
    try {
        if (budgetId) { await setDoc(doc(budgetsCol, budgetId), budgetData, { merge: true }); }
        else { budgetData.createdAt = Timestamp.now(); budgetData.status = 'pending'; await addDoc(budgetsCol, budgetData); }
        showView('view-budgets-list');
    } catch (error) { console.error("Erro ao salvar orçamento: ", error); }
});

document.getElementById('budget-form').addEventListener('input', (e) => {
    const target = e.target;
    if(target.matches('.item-desc, .item-qty, .item-val')) {
        const type = target.closest('#services-container') ? 'service' : 'product';
        const items = type === 'service' ? services : products;
        const index = target.closest('[data-index]').dataset.index;
        const parent = target.closest('[data-index]');
        items[index] = { description: parent.querySelector('.item-desc').value, quantity: parseFloat(parent.querySelector('.item-qty').value) || 1, value: parent.querySelector('.item-val').value ? parseFloat(parent.querySelector('.item-val').value) : null };
    }
    updateTotal();
});

document.getElementById('custom-period-fields').addEventListener('change', renderReports);

document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal' || e.target.id === 'close-modal-btn') closeModal();
    const actionBtn = e.target.closest('.modal-action-btn');
    if(actionBtn) handleStatusAction(actionBtn.dataset.id, actionBtn.dataset.action);
});

document.getElementById('budget-client-id').addEventListener('change', (e) => {
    document.getElementById('new-client-fields').classList.toggle('hidden', e.target.value !== 'new');
});

document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('end-date').value = today;
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    document.getElementById('start-date').value = firstDayOfMonth;
});

document.getElementById('client-search-input').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredClients = clients.filter(client => 
        client.name.toLowerCase().includes(searchTerm) || 
        (client.phone && client.phone.includes(searchTerm))
    );
    renderClientsList(filteredClients);
});

document.getElementById('budget-search-input').addEventListener('input', () => {
    renderBudgets();
});

document.getElementById('expense-search-input').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    
    const filteredExpenses = expenses.filter(expense => 
        expense.description.toLowerCase().includes(searchTerm)
    );
    
    renderExpensesList(filteredExpenses);
});

document.getElementById('calc-btn').addEventListener('click', () => {
    const percentInput = document.getElementById('calc-percent');
    const valorInput = document.getElementById('calc-valor');
    const resultadoContainer = document.getElementById('calc-resultado');
    const percent = parseFloat(percentInput.value);
    const valor = parseFloat(valorInput.value);
    if (isNaN(percent) || isNaN(valor)) {
        resultadoContainer.innerHTML = `<p class="text-red-600 font-semibold">Por favor, preencha ambos os campos com números válidos.</p>`;
        return;
    }
    const resultado = (valor * percent) / 100;
    const comDesconto = valor - resultado;
    const comAcrecimo = valor + resultado;
    resultadoContainer.innerHTML = `
        <p class="text-gray-700"><span class="font-bold">${percent}%</span> de ${formatCurrency(valor)} é: <span class="font-bold text-lg text-blue-600">${formatCurrency(resultado)}</span></p>
        <p class="mt-2 text-gray-700">Valor com <span class="font-bold text-red-600">desconto</span>: <span class="font-bold">${formatCurrency(comDesconto)}</span></p>
        <p class="mt-1 text-gray-700">Valor com <span class="font-bold text-green-600">acrécimo</span>: <span class="font-bold">${formatCurrency(comAcrecimo)}</span></p>
    `;
});

document.getElementById('image-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const canvas = document.getElementById('image-canvas');
    const ctx = canvas.getContext('2d');
    const downloadBtn = document.getElementById('download-btn');
    const previewContainer = document.getElementById('preview-container');
    const canvasLoader = document.getElementById('canvas-loader');
    previewContainer.classList.remove('hidden');
    canvasLoader.classList.remove('hidden');
    downloadBtn.classList.add('bg-gray-400', 'pointer-events-none', 'opacity-50');
    downloadBtn.classList.remove('bg-[var(--cor-primaria)]', 'hover:bg-[var(--cor-primaria-hover)]');
    const userImage = new Image();
    const logoImage = new Image();
    logoImage.crossOrigin = "Anonymous";
    const reader = new FileReader();
    reader.onload = (event) => {
        userImage.src = event.target.result;
    };
    userImage.onload = () => {
        logoImage.src = userSettings.logoUrl; 
    };
    logoImage.onload = () => {
        canvas.width = userImage.width;
        canvas.height = userImage.height;
        ctx.drawImage(userImage, 0, 0);
        const padding = canvas.width * 0.05;
        const logoHeight = canvas.height * 0.15;
        const logoWidth = (logoImage.width / logoImage.height) * logoHeight;
        const x = canvas.width - logoWidth - padding;
        const y = canvas.height - logoHeight - padding;
        ctx.globalAlpha = 0.85; 
        ctx.drawImage(logoImage, x, y, logoWidth, logoHeight);
        ctx.globalAlpha = 1.0;
        downloadBtn.href = canvas.toDataURL('image/png');
        downloadBtn.classList.remove('bg-gray-400', 'pointer-events-none', 'opacity-50');
        downloadBtn.classList.add('bg-[var(--cor-primaria)]', 'hover:bg-[var(--cor-primaria-hover)]');
        canvasLoader.classList.add('hidden');
    };
    logoImage.onerror = () => {
        alert("Não foi possível carregar o logotipo. Verifique se a URL da logo nas configurações está correta e permite acesso CORS.");
        canvasLoader.classList.add('hidden');
    };
    reader.readAsDataURL(file);
});

const formatField = (id, value) => {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
};

const generateBRCode = (pixKey, pixName, pixCity, amount, txid) => {
    const payloadFormat = formatField('00', '01');
    const merchantAccount = 
        formatField('00', 'br.gov.bcb.pix') +
        formatField('01', pixKey);
    const merchantAccountInfo = formatField('26', merchantAccount);
    const merchantCategory = formatField('52', '0000');
    const currencyCode = formatField('53', '986');
    const transactionAmount = formatField('54', amount.toFixed(2));
    const countryCode = formatField('58', 'BR');
    const merchantName = formatField('59', pixName.substring(0, 25));
    const merchantCity = formatField('60', pixCity.substring(0, 15));
    const additionalData = formatField('05', txid);
    const additionalDataField = formatField('62', additionalData);
    const payload = `${payloadFormat}${merchantAccountInfo}${merchantCategory}${currencyCode}${transactionAmount}${countryCode}${merchantName}${merchantCity}${additionalDataField}`;
    const crc16 = '6304';
    return `${payload}${crc16}`;
};

document.getElementById('pix-generate-btn').addEventListener('click', () => {
    if (!userSettings.pixKey || !userSettings.pixName || !userSettings.pixCity) {
        alert("Dados PIX não configurados! Por favor, adicione sua chave, nome e cidade no Firebase para testar.");
        return;
    }
    const valor = parseFloat(document.getElementById('pix-valor-pix').value); // ID Corrigido
    const txid = document.getElementById('pix-id').value.replace(/\s/g, '') || '***';
    if (isNaN(valor) || valor <= 0) {
        alert("Por favor, insira um valor válido.");
        return;
    }
    const brcodeText = generateBRCode(
        userSettings.pixKey, 
        userSettings.pixName, 
        userSettings.pixCity || 'SAO PAULO',
        valor, 
        txid
    );
    const qr = qrcode(0, 'M');
    qr.addData(brcodeText);
    qr.make();
    const qrCodeDataUrl = qr.createDataURL(6, 4);
    document.getElementById('pix-qrcode-img').src = qrCodeDataUrl;
    document.getElementById('pix-brcode-text').value = brcodeText;
    document.getElementById('pix-result-container').classList.remove('hidden');
});

document.getElementById('pix-copy-btn').addEventListener('click', (e) => {
    const brcodeText = document.getElementById('pix-brcode-text').value;
    navigator.clipboard.writeText(brcodeText).then(() => {
        e.target.textContent = "Copiado com Sucesso!";
        setTimeout(() => {
            e.target.textContent = "Copiar Código (Copia e Cola)";
        }, 2000);
    }).catch(err => {
        alert("Erro ao copiar o código.");
    });
});