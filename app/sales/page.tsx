"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";


type Customer = {
  id:string;
  name:string;
};


type Product = {
  id:string;
  name:string;
  sale_price:number | null;
  stock_quantity:number | null;
};


type Sale = {
  id:string;
  total_amount:number | null;
  created_at:string;
  customers:{
    name:string;
  } | null;
};



export default function SalesPage(){

const router = useRouter();


const [companyId,setCompanyId] = useState("");

const [customers,setCustomers] = useState<Customer[]>([]);
const [products,setProducts] = useState<Product[]>([]);
const [sales,setSales] = useState<Sale[]>([]);


const [customerId,setCustomerId] = useState("");
const [productId,setProductId] = useState("");

const [quantity,setQuantity] = useState("1");


const [loading,setLoading] = useState(true);
const [saving,setSaving] = useState(false);



useEffect(()=>{

loadPage();

},[]);



const selectedProduct =
products.find(
(product)=>product.id===productId
);



const unitPrice =
Number(selectedProduct?.sale_price || 0);



const saleQuantity =
Number(quantity || 0);



const totalAmount =
useMemo(()=>{

return unitPrice * saleQuantity;

},[unitPrice,saleQuantity]);





async function loadPage(){


const {
data:{user}
}=await supabase.auth.getUser();



if(!user){

router.replace("/");
return;

}



const {data:membership,error}=await supabase

.from("company_members")

.select("company_id")

.eq("user_id",user.id)

.single();



if(error){

alert(error.message);
return;

}



if(!membership){

router.replace("/dashboard");
return;

}



setCompanyId(
membership.company_id
);



await Promise.all([

loadCustomers(
membership.company_id
),

loadProducts(
membership.company_id
),

loadSales(
membership.company_id
)

]);



setLoading(false);


}




async function loadCustomers(id:string){


const {data,error}=await supabase

.from("customers")

.select("id,name")

.eq("company_id",id);



if(error){

alert(error.message);
return;

}



setCustomers(data || []);


}




async function loadProducts(id:string){


const {data,error}=await supabase

.from("products")

.select(
"id,name,sale_price,stock_quantity"
)

.eq("company_id",id);



if(error){

alert(error.message);
return;

}



setProducts(data || []);


}




async function loadSales(id:string){


const {data,error}=await supabase

.from("sales")

.select(
`
id,
total_amount,
created_at,
customers(name)
`
)

.eq("company_id",id)

.order(
"created_at",
{
ascending:false
}
);



if(error){

alert(error.message);
return;

}



setSales(
(data as unknown as Sale[]) || []
);


}
// ================= CREATE SALE =================


async function handleCreateSale(
event:FormEvent<HTMLFormElement>
){

event.preventDefault();



if(!customerId){

alert("Customer select karo");
return;

}



if(!productId){

alert("Product select karo");
return;

}



if(!selectedProduct){

alert("Product nahi mila");
return;

}



const availableStock =
Number(selectedProduct.stock_quantity || 0);



if(saleQuantity > availableStock){

alert(
Stock sirf ${availableStock} available hai
);

return;

}



setSaving(true);



const {data:sale,error:saleError}=await supabase

.from("sales")

.insert({

company_id:companyId,

customer_id:customerId,

total_amount:totalAmount

})

.select("id")

.single();



if(saleError){

setSaving(false);

alert(saleError.message);

return;

}





const {error:itemError}=await supabase

.from("sale_items")

.insert({

sale_id:sale.id,

product_id:productId,

quantity:saleQuantity,

unit_price:unitPrice,

total_price:totalAmount

});



if(itemError){

setSaving(false);

alert(itemError.message);

return;

}





const {error:stockError}=await supabase

.from("products")

.update({

stock_quantity:
availableStock - saleQuantity

})

.eq("id",productId)

.eq("company_id",companyId);



setSaving(false);



if(stockError){

alert(stockError.message);

return;

}




setCustomerId("");

setProductId("");

setQuantity("1");



await Promise.all([

loadProducts(companyId),

loadSales(companyId)

]);



alert("Sale successfully save ho gayi");


}





if(loading){

return (

<main style={loadingStyle}>

Loading...

</main>

);

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

<h1>

Sales

</h1>


<p>

Customer sale aur stock manage karo.

</p>

</div>



<div style={countStyle}>

Total Sales:
<strong>
{sales.length}
</strong>

</div>


</div>





<div style={gridStyle}>


<form

onSubmit={handleCreateSale}

style={cardStyle}

>


<h2>

Create Sale

</h2>




<select

value={customerId}

onChange={
(e)=>setCustomerId(e.target.value)
}

style={inputStyle}

>


<option value="">

Select Customer

</option>


{

customers.map(c=>(

<option

key={c.id}

value={c.id}

>

{c.name}

</option>

))

}


</select>





<select

value={productId}

onChange={
(e)=>setProductId(e.target.value)
}

style={inputStyle}

>


<option value="">

Select Product

</option>


{

products.map(p=>(

<option

key={p.id}

value={p.id}

>

{p.name} -
Stock {p.stock_quantity}

</option>


))

}


</select>





<input

type="number"

value={quantity}

min="1"

onChange={
(e)=>setQuantity(e.target.value)
}

style={inputStyle}

placeholder="Quantity"

/>





<div style={totalBox}>



<div>

Unit Price

<h3>

{unitPrice}

</h3>

</div>



<div>

Total

<h3>

{totalAmount}

</h3>

</div>



</div>




<button

disabled={saving}

style={buttonStyle}

>

{

saving ?

"Saving..." :

"Create Sale"

}


</button>



</form>





<section style={cardStyle}>


<h2>

Recent Sales

</h2>




<table style={tableStyle}>


<thead>

<tr>

<th>Date</th>

<th>Customer</th>

<th>Amount</th>

<th>Invoice</th>

</tr>

</thead>




<tbody>


{

sales.map(s=>(

<tr key={s.id}>


<td>

{
new Date(
s.created_at
).toLocaleDateString()
}

</td>


<td>

{s.customers?.name}

</td>



<td>

{s.total_amount}

</td>


<td>

<button

style={smallBtn}

onClick={()=>router.push("/invoices/"+s.id)}

>

View

</button>

</td>


</tr>


))


}


</tbody>


</table>



</section>


</div>


</div>


</main>

);

}
const pageStyle:React.CSSProperties={

minHeight:"100vh",
background:"#f5f7fb",
padding:"32px",
fontFamily:"Arial, Helvetica, sans-serif",
color:"#172033"

};



const loadingStyle:React.CSSProperties={

minHeight:"100vh",
display:"flex",
alignItems:"center",
justifyContent:"center"

};



const containerStyle:React.CSSProperties={

maxWidth:"1200px",
margin:"0 auto"

};



const backStyle:React.CSSProperties={

border:"none",
background:"transparent",
color:"#2563eb",
cursor:"pointer",
marginBottom:"20px",
fontSize:"15px"

};



const headerStyle:React.CSSProperties={

display:"flex",
justifyContent:"space-between",
alignItems:"center",
marginBottom:"25px"

};



const countStyle:React.CSSProperties={

background:"#fff",
padding:"15px 20px",
borderRadius:"12px",
border:"1px solid #eaecf0"

};



const gridStyle:React.CSSProperties={

display:"grid",
gridTemplateColumns:"380px 1fr",
gap:"25px"

};



const cardStyle:React.CSSProperties={

background:"#fff",
padding:"25px",
borderRadius:"16px",
border:"1px solid #eaecf0",
boxShadow:"0 5px 15px rgba(0,0,0,0.06)"

};



const inputStyle:React.CSSProperties={

width:"100%",
padding:"12px",
marginBottom:"15px",
border:"1px solid #d0d5dd",
borderRadius:"8px",
fontSize:"15px",
boxSizing:"border-box"

};



const totalBox:React.CSSProperties={

display:"flex",
justifyContent:"space-between",
background:"#f8fafc",
border:"1px solid #eaecf0",
padding:"15px",
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
cursor:"pointer",
fontSize:"16px"

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
fontSize:"14px",
color:"#475467"

};



const td:React.CSSProperties={

padding:"14px",
background:"#fff",
borderTop:"1px solid #eee",
borderBottom:"1px solid #eee"

};



const smallBtn:React.CSSProperties={

background:"#2563eb",
color:"#fff",
border:"none",
padding:"7px 12px",
borderRadius:"6px",
cursor:"pointer"

};