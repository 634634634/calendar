// --- ここからサンプルデータ ---
// ページ読み込み時に表示される初期データです。
// Excelからインポートすると、このデータは上書きされます。
const sampleData = [
    {
        name: "A株式会社",
        applyTax: true,
        products: [
            { id: 1, name: "商品アルファ", price: 1000 },
            { id: 2, name: "商品ベータ", price: 1500 },
            { id: 3, name: "商品ガンマ", price: 2200 },
        ]
    },
    {
        name: "B商店 (税抜)",
        applyTax: false,
        products: [
            { id: 1, name: "商品アルファ", price: 980 },
            { id: 4, name: "商品デルタ", price: 3000 },
        ]
    },
    {
        name: "C合同会社",
        applyTax: true,
        products: [
            { id: 1, name: "商品アルファ", price: 1000 },
            { id: 2, name: "商品ベータ", price: 1450 },
            { id: 4, name: "商品デルタ", price: 3100 },
            { id: 5, name: "商品イプシロン", price: 500 },
        ]
    }
];
// --- サンプルデータここまで ---


document.addEventListener('DOMContentLoaded', () => {
    // --- DOM要素の取得 ---
    const fileInput = document.getElementById('file-input');
    const customerSelect = document.getElementById('customer-select');
    const productListDiv = document.getElementById('product-list');
    const subtotalEl = document.getElementById('subtotal');
    const taxAmountEl = document.getElementById('tax-amount');
    const totalAmountEl = document.getElementById('total-amount');
    const taxRateDisplayEl = document.getElementById('tax-rate-display');
    const resetButton = document.getElementById('reset-button');

    // --- グローバル変数 ---
    let customerData = []; // Excelから読み込んだデータを格納
    let currentCustomer = null;
    const TAX_RATE = 0.10; // 消費税率 (10%)

    // --- 初期化処理 ---
    function initializeApp() {
        customerData = sampleData; // 初期データとしてサンプルをセット
        initializeCustomerSelect();
    }

    // --- イベントリスナーの設定 ---

    // 1. Excelファイル読み込み処理
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                // JSONデータをアプリ用のデータ構造に変換
                const parsedData = parseExcelData(json);
                if (parsedData.length === 0) {
                    alert("ファイルから有効なデータを読み込めませんでした。ヘッダー（得意先名, 商品名, 価格, 消費税適用）が正しいか確認してください。");
                    return;
                }
                customerData = parsedData;
                
                // UIを更新
                initializeCustomerSelect();
                alert(`${customerData.length}件の得意先データを読み込みました。`);

            } catch (error) {
                console.error("ファイルの読み込みまたは解析に失敗しました:", error);
                alert("ファイルの読み込みに失敗しました。フォーマットが正しいか確認してください。");
            } finally {
                // ファイル選択をリセットして同じファイルを再選択できるようにする
                fileInput.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    });

    // 2. 得意先が選択されたときの処理
    customerSelect.addEventListener('change', () => {
        const selectedIndex = customerSelect.value;
        if (selectedIndex === "") {
            currentCustomer = null;
            productListDiv.innerHTML = '<p style="padding: 1rem 0 0 0; color: var(--muted-text-color);">商品リストが表示されます。</p>';
            resetCalculation();
            return;
        }
        currentCustomer = customerData[selectedIndex];
        renderProductList();
        updateTotals();
    });
    
    // 3. リセットボタンの処理
    resetButton.addEventListener('click', () => {
        if (currentCustomer) {
            renderProductList(); // 商品リストを再描画して入力を0にする
            updateTotals();
        }
    });


    // --- 関数定義 ---

    /**
     * Excelから読み込んだJSONを行ごとに処理し、アプリ用のデータ構造に変換する
     * @param {Array} jsonData - sheet_to_jsonで生成された配列
     * @returns {Array} - アプリケーション用のcustomerData配列
     */
    function parseExcelData(jsonData) {
        const customers = new Map();
        let productIdCounter = 1;

        jsonData.forEach(row => {
            const customerName = row['得意先名'];
            const productName = row['商品名'];
            const price = row['価格'];
            // TRUE, true, 'TRUE', 'true' などを判定
            const applyTax = String(row['消費税適用']).trim().toUpperCase() === 'TRUE';

            if (!customerName || !productName || price === undefined || isNaN(parseFloat(price))) {
                return; // 不正な行はスキップ
            }

            if (!customers.has(customerName)) {
                customers.set(customerName, {
                    name: customerName,
                    applyTax: applyTax, // 最初の行の消費税設定を代表として使用
                    products: []
                });
            }

            const customer = customers.get(customerName);
            customer.products.push({
                id: productIdCounter++,
                name: productName,
                price: Number(price)
            });
        });

        return Array.from(customers.values());
    }

    /**
     * 得意先選択プルダウンを初期化
     */
    function initializeCustomerSelect() {
        customerSelect.innerHTML = '<option value="">-- 得意先を選択 --</option>'; // 選択肢をクリア
        productListDiv.innerHTML = '<p style="padding: 1rem 0 0 0; color: var(--muted-text-color);">商品リストが表示されます。</p>';
        resetCalculation();

        customerData.forEach((customer, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = customer.name;
            customerSelect.appendChild(option);
        });
    }

    /**
     * 商品リストを描画
     */
    function renderProductList() {
        productListDiv.innerHTML = ''; // リストをクリア
        if (!currentCustomer) return;

        currentCustomer.products.forEach(product => {
            const productItem = document.createElement('div');
            productItem.className = 'product-item';
            productItem.innerHTML = `
                <div class="product-info">
                    <div class="product-name">${product.name}</div>
                    <div class="product-price">@ ${product.price.toLocaleString()}</div>
                </div>
                <div class="product-input">
                    <input type="number" class="quantity-input" data-price="${product.price}" min="0" placeholder="0">
                    <span class="item-subtotal">¥ 0</span>
                </div>
            `;
            productListDiv.appendChild(productItem);
        });

        document.querySelectorAll('.quantity-input').forEach(input => {
            input.addEventListener('input', () => {
                updateItemSubtotal(input);
                updateTotals();
            });
        });
    }
    
    /**
     * 各商品の小計を更新
     * @param {HTMLInputElement} input 
     */
    function updateItemSubtotal(input) {
        const quantity = parseInt(input.value) || 0;
        const price = parseFloat(input.dataset.price);
        const itemSubtotal = quantity * price;
        
        const itemSubtotalEl = input.nextElementSibling;
        itemSubtotalEl.textContent = `¥ ${itemSubtotal.toLocaleString()}`;
    }

    /**
     * 全体の合計を計算・更新
     */
    function updateTotals() {
        if (!currentCustomer) {
            resetCalculation();
            return;
        }

        let subtotal = 0;
        document.querySelectorAll('.quantity-input').forEach(input => {
            const quantity = parseInt(input.value) || 0;
            const price = parseFloat(input.dataset.price);
            subtotal += quantity * price;
        });

        const taxRate = currentCustomer.applyTax ? TAX_RATE : 0;
        const taxAmount = Math.floor(subtotal * taxRate);
        const totalAmount = subtotal + taxAmount;

        subtotalEl.textContent = `¥ ${subtotal.toLocaleString()}`;
        taxRateDisplayEl.textContent = taxRate * 100;
        taxAmountEl.textContent = `¥ ${taxAmount.toLocaleString()}`;
        totalAmountEl.textContent = `¥ ${totalAmount.toLocaleString()}`;
    }
    
    /**
     * 計算結果をリセット
     */
    function resetCalculation() {
        subtotalEl.textContent = '¥ 0';
        taxAmountEl.textContent = '¥ 0';
        totalAmountEl.textContent = '¥ 0';
        taxRateDisplayEl.textContent = '0';
    }

    // アプリケーションを起動
    initializeApp();
});
