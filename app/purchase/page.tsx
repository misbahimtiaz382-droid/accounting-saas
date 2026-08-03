"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";


type Supplier = {
  id:string;
  name:string;
};


type Product = {
  id:string;
  name:string;
  purchase_price:number | null;
  stock_quantity:number | null;
};


type Purchase = {
  id:string;
  invoice_number:string | null;
  total_amount:number | null;
  payment_status:string | null;
  created_at:string;

  suppliers:{
    name:string;
  } | null;
};


export default function PurchasesPage(){

const router = useRouter();


const [companyId,setCompanyId] = useState("");

const [suppliers,setSuppliers] = useState<Supplier[]>([]);
const [products,setProducts] = useState<Product[]>([]);
const [purchases,setPurchases] = useState<Purchase[]>([]);


const [supplierId,setSupplierId] = useState("");
const [productId,setProductId] = useState("");

const [quantity,setQuantity] = useState("1");
const [unitPrice,setUnitPrice] = useState("");

const [loading,setLoading] = useState(true);
const [saving,setSaving] = useState(false);



useEffect(()=>{
loadPage();
},[]);



async function loadPage(){

const {
data:{user}
}= await supabase.auth.getUser();


if(!user){
router.replace("/");
return;
}


const {data:membership}=await supabase
.from("company_members")
.select("company_id")
.eq("user_id",user.id)
.single();


if(!membership){
router.replace("/dashboard");
return;
}


setCompanyId(membership.company_id);



await Promise.all([
loadSuppliers(membership.company_id),
loadProducts(membership.company_id),
loadPurchases(membership.company_id)
]);


setLoading(false);

}



async function loadSuppliers(id:string){

const {data,error}=await supabase
.from("suppliers")
.select("id,name")
.eq("company_id",id);


if(error){
alert(error.message);
return;
}


setSuppliers(data || []);

}




async function loadProducts(id:string){

const {data,error}=await supabase
.from("products")
.select("id,name,purchase_price,stock_quantity")
.eq("company_id",id);


if(error){
alert(error.message);
return;
}


setProducts(data || []);

}




async function loadPurchases(id:string){

const {data,error}=await supabase
.from("purchases")
.select(`
id,
invoice_number,
total_amount,
payment_status,
created_at,
suppliers(name)
`)
.eq("company_id",id)
.order("created_at",{ascending:false});


if(error){
alert(error.message);
return;
}


setPurchases(data as any || []);

}




const selectedProduct =
products.find(
(item)=>item.id===productId
);



const totalAmount =
Number(quantity || 0) *
Number(unitPrice || 0);




function handleProduct(value:string){

setProductId(value);


const product =
products.find(
(item)=>item.id===value
);


if(product){

setUnitPrice(
String(product.purchase_price || 0)
);

}

}




async function createPurchase(
e:FormEvent
){

e.preventDefault();


if(!supplierId || !productId){

alert("Supplier aur Product select karo");
return;

}



setSaving(true);



const {data:purchase,error}=await supabase
.from("purchases")
.insert({

company_id:companyId,
supplier_id:supplierId,
total_amount:totalAmount,
payment_status:"unpaid"

})
.select()
.single();



if(error){

alert(error.message);
setSaving(false);
return;

}



await supabase
.from("purchase_items")
.insert({

purchase_id:purchase.id,
product_id:productId,
quantity:Number(quantity),
unit_price:Number(unitPrice),
total_price:totalAmount

});



if(selectedProduct){

await supabase
.from("products")
.update({

stock_quantity:
Number(selectedProduct.stock_quantity || 0)
+
Number(quantity),

purchase_price:Number(unitPrice)

})
.eq("id",productId);

}



setSupplierId("");
setProductId("");
setQuantity("1");
setUnitPrice("");


await loadPurchases(companyId);
await loadProducts(companyId);


setSaving(false);


alert("Purchase save hogi");

}
return (

<main style={pageStyle}>

<div style={containerStyle}>


<button
onClick={()=>router.push("/dashboard")}
style={backStyle}
>
← Back to Dashboard
</button>



<div style={headerStyle}>

<div>
<h1>Purchases</h1>
<p style={{color:"#667085"}}>
Manage supplier purchases and stock
</p>
</div>


<div style={counterStyle}>
Total Purchases:
<b>{purchases.length}</b>
</div>


</div>





<div style={layoutStyle}>


<form
onSubmit={createPurchase}
style={cardStyle}
>


<h2>Create Purchase</h2>



<select
value={supplierId}
onChange={(e)=>setSupplierId(e.target.value)}
style={inputStyle}
>

<option value="">
Select Supplier
</option>


{
suppliers.map((s)=>(
<option
key={s.id}
value={s.id}
>
{s.name}
</option>
))
}

</select>





<select
value={productId}
onChange={(e)=>handleProduct(e.target.value)}
style={inputStyle}
>


<option value="">
Select Product
</option>


{
products.map((p)=>(

<option
key={p.id}
value={p.id}
>

{p.name}

</option>

))
}


</select>




<input

type="number"

value={quantity}

onChange={(e)=>setQuantity(e.target.value)}

placeholder="Quantity"

style={inputStyle}

/>



<input

type="number"

value={unitPrice}

onChange={(e)=>setUnitPrice(e.target.value)}

placeholder="Purchase Price"

style={inputStyle}

/>



<div style={totalBox}>

<div>
Quantity
<b>{quantity}</b>
</div>


<div>
Total
<b>Rs {totalAmount}</b>
</div>


</div>





<button

disabled={saving}

style={buttonStyle}

>

{
saving?
"Saving..."
:
"Create Purchase"
}


</button>



</form>








<section style={cardStyle}>


<h2>
Recent Purchases
</h2>




<div style={{overflowX:"auto"}}>


<table style={tableStyle}>


<thead>

<tr>

<th style={th}>
Date
</th>


<th style={th}>
Invoice
</th>


<th style={th}>
Supplier
</th>


<th style={th}>
Amount
</th>


<th style={th}>
Payment
</th>


</tr>

</thead>




<tbody>


{

purchases.map((p)=>(


<tr
key={p.id}
style={rowStyle}
>



<td style={td}>
{
new Date(
p.created_at
)
.toLocaleDateString()
}
</td>



<td style={td}>
{
p.invoice_number || "-"
}
</td>




<td style={td}>
{
p.suppliers?.name || "-"
}
</td>




<td style={td}>
Rs {p.total_amount}
</td>




<td style={td}>

<span style={statusStyle}>

{
p.payment_status
}

</span>

</td>




</tr>


))

}



</tbody>


</table>


</div>



</section>


</div>



</div>

</main>


);

}




const pageStyle:React.CSSProperties={

minHeight:"100vh",

background:"#f5f7fb",

padding:"30px",

fontFamily:"Arial"

};



const containerStyle:React.CSSProperties={

maxWidth:"1200px",

margin:"auto"

};



const headerStyle:React.CSSProperties={

display:"flex",

justifyContent:"space-between",

alignItems:"center",

marginBottom:"25px"

};



const counterStyle:React.CSSProperties={

background:"#fff",

padding:"15px 20px",

borderRadius:"12px",

border:"1px solid #ddd"

};



const backStyle:React.CSSProperties={

border:"none",

background:"none",

color:"#2563eb",

cursor:"pointer"

};



const layoutStyle:React.CSSProperties={

display:"grid",

gridTemplateColumns:"380px 1fr",

gap:"25px"

};



const cardStyle:React.CSSProperties={

background:"#fff",

padding:"25px",

borderRadius:"15px",

border:"1px solid #e5e7eb"

};



const inputStyle:React.CSSProperties={

width:"100%",

padding:"12px",

marginBottom:"15px",

border:"1px solid #ddd",

borderRadius:"8px"

};



const totalBox:React.CSSProperties={

display:"flex",

justifyContent:"space-between",

padding:"15px",

background:"#f8fafc",

borderRadius:"10px",

marginBottom:"15px"

};



const buttonStyle:React.CSSProperties={

width:"100%",

padding:"13px",

background:"#2563eb",

color:"#fff",

border:"none",

borderRadius:"8px",

cursor:"pointer"

};



const tableStyle:React.CSSProperties={

width:"100%",

borderCollapse:"separate",

borderSpacing:"0 10px"

};



const th:React.CSSProperties={

background:"#f1f5f9",

padding:"14px",

textAlign:"left",

fontSize:"14px"

};



const td:React.CSSProperties={

padding:"15px",

background:"#fff",

borderTop:"1px solid #eee",

borderBottom:"1px solid #eee"

};



const rowStyle:React.CSSProperties={

boxShadow:"0 2px 8px rgba(0,0,0,0.05)"

};



const statusStyle:React.CSSProperties={

background:"#fff3cd",

padding:"6px 12px",

borderRadius:"20px",

fontSize:"13px"

};