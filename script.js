const STORAGE_KEY = "expense-tracker-expenses";
const CURRENCY = "GH\u20B5";

const form = document.getElementById("expense-form");
const nameInput = document.getElementById("expense-name");
const amountInput = document.getElementById("expense-amount");
const categoryInput = document.getElementById("expense-category");
const dateInput = document.getElementById("expense-date");
const categoryFilter = document.getElementById("filter-category");
const dateFilter = document.getElementById("filter-date");
const clearFiltersButton = document.getElementById("clear-filters");
const expenseList = document.getElementById("expense-list");
const totalAmount = document.getElementById("total-amount");
const expenseCount = document.getElementById("expense-count");
const emptyState = document.getElementById("empty-state");

let expenses = loadExpenses();
let editingExpenseId = null;

form.addEventListener("submit", handleSubmit);
categoryFilter.addEventListener("change", renderExpenses);
dateFilter.addEventListener("change", renderExpenses);
clearFiltersButton.addEventListener("click", clearFilters);

renderExpenses();

function handleSubmit(event) {
  event.preventDefault();

  const expense = {
    id: createId(),
    name: nameInput.value.trim(),
    amount: Number.parseFloat(amountInput.value),
    category: categoryInput.value,
    date: dateInput.value,
  };

  const error = validateExpense(expense);
  if (error) {
    showMessage(error.message, error.element);
    return;
  }

  expenses = [expense, ...expenses];
  saveExpenses();
  form.reset();
  nameInput.focus();
  renderExpenses();
}

function renderExpenses() {
  const visibleExpenses = getFilteredExpenses();
  expenseList.replaceChildren();

  visibleExpenses.forEach((expense) => {
    expenseList.appendChild(createExpenseRow(expense));
  });

  const hasVisibleExpenses = visibleExpenses.length > 0;
  emptyState.hidden = hasVisibleExpenses;
  emptyState.textContent = expenses.length
    ? "No expenses match the selected filters."
    : "Add your first expense to start tracking spending.";

  expenseCount.textContent = buildCountText(visibleExpenses.length);
  totalAmount.textContent = formatAmount(getTotal(visibleExpenses));
}

function createExpenseRow(expense) {
  const row = document.createElement("tr");
  row.dataset.id = expense.id;

  if (editingExpenseId === expense.id) {
    return createEditingExpenseRow(expense, row);
  }

  row.appendChild(createEditableCell(expense, "name", expense.name, "text"));
  row.appendChild(
    createEditableCell(expense, "category", expense.category, "select"),
  );
  row.appendChild(
    createEditableCell(
      expense,
      "amount",
      formatCurrency(expense.amount),
      "number",
    ),
  );
  row.appendChild(createEditableCell(expense, "date", expense.date, "date"));

  const actionCell = document.createElement("td");
  const actionGroup = document.createElement("div");
  actionGroup.className = "action-buttons";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "secondary-button";
  editButton.textContent = "Edit";
  editButton.addEventListener("click", () => startEditingExpense(expense.id));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger-button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => deleteExpense(expense.id));

  actionGroup.append(editButton, deleteButton);
  actionCell.appendChild(actionGroup);
  row.appendChild(actionCell);

  return row;
}

function createEditingExpenseRow(expense, row) {
  row.className = "editing-row";
  row.appendChild(
    createEditFieldCell("name", createInputEditor("text", expense.name)),
  );
  row.appendChild(
    createEditFieldCell("category", createCategoryEditor(expense.category)),
  );
  row.appendChild(
    createEditFieldCell("amount", createInputEditor("number", expense.amount)),
  );
  row.appendChild(
    createEditFieldCell("date", createInputEditor("date", expense.date)),
  );

  const actionCell = document.createElement("td");
  const actionGroup = document.createElement("div");
  actionGroup.className = "action-buttons";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "primary-button";
  saveButton.textContent = "Save";
  saveButton.addEventListener("click", () =>
    saveEditedExpense(expense.id, row),
  );

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "ghost-button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", cancelEditingExpense);

  actionGroup.append(saveButton, cancelButton);
  actionCell.appendChild(actionGroup);
  row.appendChild(actionCell);

  return row;
}

function createEditFieldCell(field, editor) {
  const cell = document.createElement("td");
  editor.dataset.editField = field;
  cell.appendChild(editor);
  return cell;
}

function createEditableCell(expense, field, value, type) {
  const cell = document.createElement("td");
  cell.tabIndex = 0;
  cell.dataset.field = field;
  cell.textContent = value;
  cell.title = "Click to edit";
  cell.addEventListener("click", () => editCell(cell, expense, field, type));
  cell.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      editCell(cell, expense, field, type);
    }
  });
  return cell;
}

function editCell(cell, expense, field, type) {
  if (cell.dataset.editing === "true") return;

  cell.dataset.editing = "true";
  const currentValue = expense[field];
  const editor =
    type === "select"
      ? createCategoryEditor(currentValue)
      : createInputEditor(type, currentValue);

  cell.replaceChildren(editor);
  editor.focus();

  editor.addEventListener("keydown", (event) => {
    if (event.key === "Enter") editor.blur();
    if (event.key === "Escape") renderExpenses();
  });

  editor.addEventListener(
    "blur",
    () => {
      const nextValue = parseEditorValue(editor.value, type);
      const updatedExpense = { ...expense, [field]: nextValue };
      const error = validateExpense(updatedExpense, field);

      if (error) {
        showMessage(error.message, cell);
        renderExpenses();
        return;
      }

      expenses = expenses.map((item) =>
        item.id === expense.id ? updatedExpense : item,
      );
      saveExpenses();
      renderExpenses();
    },
    { once: true },
  );
}

function createInputEditor(type, value) {
  const input = document.createElement("input");
  input.type = type;
  input.className = "inline-editor";
  input.value = type === "number" ? Number(value).toFixed(2) : value;
  if (type === "number") {
    input.min = "0.01";
    input.step = "0.01";
  }
  return input;
}

function createCategoryEditor(value) {
  const select = document.createElement("select");
  select.className = "inline-editor";
  ["Food", "Transport", "Bills", "Shopping", "Health", "Other"].forEach(
    (category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      option.selected = category === value;
      select.appendChild(option);
    },
  );
  return select;
}

function parseEditorValue(value, type) {
  if (type === "number") return Number.parseFloat(value);
  return value.trim();
}

function deleteExpense(id) {
  if (editingExpenseId === id) {
    editingExpenseId = null;
  }

  expenses = expenses.filter((expense) => expense.id !== id);
  saveExpenses();
  renderExpenses();
}

function startEditingExpense(id) {
  editingExpenseId = id;
  renderExpenses();
}

function cancelEditingExpense() {
  editingExpenseId = null;
  renderExpenses();
}

function saveEditedExpense(id, row) {
  const updatedExpense = {
    id,
    name: row.querySelector('[data-edit-field="name"]').value.trim(),
    category: row.querySelector('[data-edit-field="category"]').value,
    amount: Number.parseFloat(
      row.querySelector('[data-edit-field="amount"]').value,
    ),
    date: row.querySelector('[data-edit-field="date"]').value,
  };

  const error = validateExpense(updatedExpense);
  if (error) {
    showMessage(error.message, row);
    return;
  }

  expenses = expenses.map((expense) =>
    expense.id === id ? updatedExpense : expense,
  );
  editingExpenseId = null;
  saveExpenses();
  renderExpenses();
}

function getFilteredExpenses() {
  return expenses.filter((expense) => {
    const matchesCategory =
      categoryFilter.value === "all" ||
      expense.category === categoryFilter.value;
    const matchesDate = !dateFilter.value || expense.date === dateFilter.value;
    return matchesCategory && matchesDate;
  });
}

function clearFilters() {
  categoryFilter.value = "all";
  dateFilter.value = "";
  renderExpenses();
}

function validateExpense(expense, changedField) {
  if ((!changedField || changedField === "name") && !expense.name) {
    return { message: "Expense name is required.", element: nameInput };
  }

  if (
    (!changedField || changedField === "amount") &&
    (!Number.isFinite(expense.amount) || expense.amount <= 0)
  ) {
    return { message: "Enter an amount greater than 0.", element: amountInput };
  }

  if ((!changedField || changedField === "category") && !expense.category) {
    return { message: "Select a category.", element: categoryInput };
  }

  if (
    (!changedField || changedField === "date") &&
    !isValidDate(expense.date)
  ) {
    return { message: "Choose a valid expense date.", element: dateInput };
  }

  return null;
}

function isValidDate(value) {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

function getTotal(items) {
  return items.reduce((sum, expense) => sum + expense.amount, 0);
}

function buildCountText(count) {
  if (count === 0) return "No expenses recorded.";
  if (count === 1) return "Showing 1 expense.";
  return `Showing ${count} expenses.`;
}

function formatCurrency(amount) {
  return `${CURRENCY}${formatAmount(amount)}`;
}

function formatAmount(amount) {
  return Number(amount).toFixed(2);
}

function loadExpenses() {
  try {
    const savedExpenses = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    return savedExpenses
      .map((expense) => ({
        id: expense.id || createId(),
        name: String(expense.name || "").trim(),
        amount: Number.parseFloat(expense.amount),
        category: expense.category || "Other",
        date: expense.date || "",
      }))
      .filter((expense) => !validateStoredExpense(expense));
  } catch {
    return [];
  }
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function validateStoredExpense(expense) {
  return (
    !expense.name ||
    !Number.isFinite(expense.amount) ||
    expense.amount <= 0 ||
    !expense.category ||
    !isValidDate(expense.date)
  );
}

function showMessage(message, element) {
  const existingMessage = document.querySelector(".feedback-message");
  existingMessage?.remove();

  const feedback = document.createElement("p");
  feedback.className = "feedback-message";
  feedback.textContent = message;
  feedback.setAttribute("role", "alert");
  document.body.appendChild(feedback);

  const rect = element.getBoundingClientRect();
  feedback.style.left = `${rect.left + window.scrollX}px`;
  feedback.style.top = `${rect.bottom + window.scrollY + 8}px`;

  setTimeout(() => feedback.remove(), 3000);
}
