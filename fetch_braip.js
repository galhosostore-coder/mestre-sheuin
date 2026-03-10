const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6ImNjM2QzZDdhMzZjYzg0MmQ3NDA4ZTRkOGRlMDk3NzBkZTkyMjA0NjMyYWMyNDVmYjZmNDU2NWUwZWQxNzlhYjQ5ZjRlNGJhOTAwMjA0YWU2In0.eyJhdWQiOiI0Nzc1MyIsImp0aSI6ImNjM2QzZDdhMzZjYzg0MmQ3NDA4ZTRkOGRlMDk3NzBkZTkyMjA0NjMyYWMyNDVmYjZmNDU2NWUwZWQxNzlhYjQ5ZjRlNGJhOTAwMjA0YWU2IiwiaWF0IjoxNzczMDc3NDY3LCJuYmYiOjE3NzMwNzc0NjcsImV4cCI6MTgwNDYxMzQ2Nywic3ViIjoiMTQ0Nzg2NjciLCJzY29wZXMiOltdfQ.Yj-o2-ICRAJoE1VTerCSB3jqzyG8U5wbUk9UvGv0bdvUmWEzrK5IR3HX6whBk_TsQUPrpGVKwsxUDxyjEpRaS45Uni5g1ISSy72J8FAOMy3J3AnZpscCpHUgQL8202NJk3bRuczreNVwBqHSIk5ytUmEDYD19X_FKWu1OkyS9oEtCYqyJc_bp4L38GeSOkLIRt1uEDZI6a4hkp5zl8CCHGE8qydat4kAfV67PjQBUT3_6P586nfhqbKt2vPbx-3kZNB83uXmlq5qWNMtdZ8K3Ysu4QxoF9Rts4jgYuUeh_MjiJlSXVMRC_94namMwhH0Td7j63Zg_JhnuPFa2ktnrQzH6CVuasSR2Xh_L7zmVs8UI1O3xT9h7qYEwsyJbaG2VN2Tg_Snh2D_mnlAkUeH0KVNj9AscgLlbHcHmCEpFNYGA7xB8L_fT5p00Y19spqlp48rSTu2cmiMly4rwrTMOLuRVLqTdCftORMsBdWz9QB_bYOZnMBdkMtJkmWtxtTNVdExMiYAGuK_RkcuGr3wtkBS0L7ysY-TsVE7o0KVyzLPMjN3Yh6OQnKnvaVftN5iU8M-BT6M8CZWRrwRIlq2D0RWvrM4yCZJn5nlUvY-hWrt5uLgBINj-yeJp-lxgqcveQWMf0u-Kqz5lneUeo42q9X5_uob4-pyeDkYKiDVoHk';

const url = 'https://ev.braip.com/api/v1/affiliates/products';

async function fetchAndFormatBraip() {
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        const status = response.status;
        
        if (status >= 200 && status < 300) {
            const data = await response.json();
            
            if (data && data.data) {
                const formatted = data.data.map(product => {
                    const linksCheckout = product.checkouts_links ? product.checkouts_links.map(ck => {
                        const allLinks = ck.links ? ck.links.map(l => `  - ${l.description}: ${l.url}`).join('\n') : '';
                        return `- ${ck.name}:\n${allLinks}`;
                    }).join('\n') : 'Nenhum link de checkout disponível.';

                    return {
                        nome: product.name,
                        descricao: product.description.substring(0, 300) + (product.description.length > 300 ? '...' : ''),
                        links: linksCheckout
                    };
                });
                
                formatted.forEach((item, index) => {
                    console.log(`\n### Produto ${index + 1}: ${item.nome}`);
                    console.log(`\n**Descrição:**`);
                    console.log(item.descricao);
                    console.log(`\n**Links de Checkout:**`);
                    console.log(item.links);
                    console.log(`\n---------------------------------------------------------`);
                });
                
            } else {
                console.log("Formato inesperado de dados:", data);
            }
            
        } else {
            console.error(`Erro: Status ${status}`);
        }
    } catch (error) {
        console.error(`Error fetching ${url}:`, error.message);
    }
}

fetchAndFormatBraip();