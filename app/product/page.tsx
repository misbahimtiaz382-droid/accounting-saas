"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";


type Product = {
  id: string;
  sku: string;
  name: string;
  purchase_price: number;
  sale_price: number;
  stock_quantity: number;
  created_at: string;
};


export default function ProductPage(){

const [products,setProducts] = useState<Product[]>([]);

const [name,setName] = useState("");
const [sku,setSku] = useState("");
const [purchasePrice,setPurchasePrice] = useState("");
const [salePrice,setSalePrice] = useState("");
const [stock,setStock] = useState("");



useEffect(()=>{
loadProducts();
},[]);



async function getCompanyId(){

const {
data:{user}
}=await supabase.auth.getUser();


if(!user) return null;


const {data,error}=await supabase
.from("company_members")
.select("company_id")
.eq("user_id",user.id)
.single();


if(error){
alert(error.message);
return null;
}


return data.company_id;

}




async function loadProducts(){

const companyId = await getCompanyId();

if(!companyId) return;


const {data,error}=await supabase
.from("products")
.select("*")
.eq("company_id",companyId)
.order("created_at",{ascending:false});


if(error){
alert(error.message);
return;
}


setProducts(data || []);

}





async function addProduct(){

if(
!sku ||
!name ||
!purchasePrice ||
!salePrice ||
!stock
){

alert("Fill all fields");
return;

}



const companyId = await getCompanyId();


if(!companyId) return;



const {error}=await supabase
.from("products")
.insert({

company_id:companyId,

sku,

name,

purchase_price:Number(purchasePrice),

sale_price:Number(salePrice),

stock_quantity:Number(stock)

});



if(error){

alert(error.message);
return;

}



setSku("");
setName("");
setPurchasePrice("");
setSalePrice("");
setStock("");


loadProducts();


}




async function deleteProduct(id:string){


const confirmDelete = confirm(
"Delete this product?"
);


if(!confirmDelete)return;



const {error}=await supabase
.from("products")
.delete()
.eq("id",id);



if(error){

alert(error.message);
return;

}


loadProducts();


}




return (

<main style={pageStyle}>


<h1>Products</h1>

<p style={{color:"#667085"}}>
Manage your inventory
</p>



<div style={statsContainer}>


<div style={statCard}>
<p>Total Products</p>
<h2>{products.length}</h2>
</div>


<div style={statCard}>
<p>Total Stock</p>
<h2>
{
products.reduce(
(sum,item)=>sum+item.stock_quantity,
0
)
}
</h2>
</div>


<div style={statCard}>
<p>Low Stock</p>
<h2>
{
products.filter(
(item)=>item.stock_quantity<=5
).length
}
</h2>
</div>


</div>
<div style={formCard}>

<h2>Add New Product</h2>


<input
placeholder="SKU"
value={sku}
onChange={(e)=>setSku(e.target.value)}
style={inputStyle}
/>


<input
placeholder="Product Name"
value={name}
onChange={(e)=>setName(e.target.value)}
style={inputStyle}
/>


<input
placeholder="Purchase Price"
type="number"
value={purchasePrice}
onChange={(e)=>setPurchasePrice(e.target.value)}
style={inputStyle}
/>


<input
placeholder="Sale Price"
type="number"
value={salePrice}
onChange={(e)=>setSalePrice(e.target.value)}
style={inputStyle}
/>


<input
placeholder="Stock Quantity"
type="number"
value={stock}
onChange={(e)=>setStock(e.target.value)}
style={inputStyle}
/>



<button
onClick={addProduct}
style={buttonStyle}
>
Add Product
</button>


</div>





<div style={tableCard}>

<h2>
Product Inventory
</h2>



<table style={tableStyle}>

<thead>

<tr>

<th style={thStyle}>SKU</th>

<th style={thStyle}>Product Name</th>

<th style={thStyle}>Purchase</th>

<th style={thStyle}>Sale</th>

<th style={thStyle}>Stock</th>

<th style={thStyle}>Date</th>

<th style={thStyle}>Status</th>

<th style={thStyle}>Action</th>

</tr>

</thead>



<tbody>

{

products.map((product)=>(

<tr key={product.id}>


<td style={tdStyle}>
{product.sku}
</td>


<td style={tdStyle}>
{product.name}
</td>


<td style={tdStyle}>
{product.purchase_price}
</td>


<td style={tdStyle}>
{product.sale_price}
</td>


<td style={tdStyle}>
{product.stock_quantity}
</td>


<td style={tdStyle}>
{
new Date(product.created_at)
.toLocaleDateString()
}
</td>


<td style={tdStyle}>

<span
style={
product.stock_quantity===0
?
outBadge
:
product.stock_quantity<=5
?
lowBadge
:
goodBadge
}
>

{
product.stock_quantity===0
?
"Out of Stock"
:
product.stock_quantity<=5
?
"Low Stock"
:
"In Stock"
}

</span>

</td>


<td style={tdStyle}>

<button
style={deleteButton}
onClick={()=>deleteProduct(product.id)}
>
Delete
</button>

</td>


</tr>

))

}


</tbody>

</table>

</div>


</main>

);

}




const pageStyle:React.CSSProperties={

padding:"30px",
background:"#f5f7fb",
minHeight:"100vh",
fontFamily:"Arial",
color:"#172033"

};



const statsContainer:React.CSSProperties={

display:"flex",
gap:"20px",
marginBottom:"30px"

};



const statCard:React.CSSProperties={

background:"#fff",
padding:"20px",
borderRadius:"14px",
width:"220px",
boxShadow:"0 4px 15px rgba(0,0,0,0.08)"

};



const formCard:React.CSSProperties={

background:"#fff",
padding:"25px",
borderRadius:"15px",
width:"420px",
display:"grid",
gap:"12px",
marginBottom:"30px"

};



const inputStyle:React.CSSProperties={

padding:"12px",
border:"1px solid #ddd",
borderRadius:"8px"

};



const buttonStyle:React.CSSProperties={

padding:"12px",
background:"#2563eb",
color:"#fff",
border:"none",
borderRadius:"8px",
cursor:"pointer"

};



const tableCard:React.CSSProperties={

background:"#fff",
padding:"25px",
borderRadius:"15px",
boxShadow:"0 4px 15px rgba(0,0,0,0.08)",
overflowX:"auto"

};



const tableStyle:React.CSSProperties={

width:"100%",
borderCollapse:"collapse"

};



const thStyle:React.CSSProperties={

padding:"14px",
background:"#f9fafb",
textAlign:"left",
borderBottom:"1px solid #ddd"

};



const tdStyle:React.CSSProperties={

padding:"14px",
borderBottom:"1px solid #eee"

};



const lowBadge:React.CSSProperties={

background:"#fee2e2",
color:"#b91c1c",
padding:"6px 12px",
borderRadius:"20px"

};



const goodBadge:React.CSSProperties={

background:"#dcfce7",
color:"#15803d",
padding:"6px 12px",
borderRadius:"20px"

};



const outBadge:React.CSSProperties={

background:"#fef3c7",
color:"#b45309",
padding:"6px 12px",
borderRadius:"20px"

};



const deleteButton:React.CSSProperties={

background:"#dc2626",
color:"#fff",
border:"none",
padding:"8px 12px",
borderRadius:"7px",
cursor:"pointer"

};