var db = require('../config/connection')
var collection = require('../config/collections')
const bcrypt = require('bcrypt')
const { USER_COLLECTION, PRODUCT_COLLECTION } = require('../config/collections')
const { response } = require('../app')
var objectId = require('mongodb').ObjectId

module.exports ={
   doSignup:(userData)=>{
    return new Promise(async(resolve,reject)=>{
        let user = await db.get().collection(collection.USER_COLLECTION).findOne({email:userData.email})
        if(user){
            resolve({status:false})

        }
        
        else{
                      
            userData.password =await bcrypt.hash(userData.password,10)
            db.get().collection(collection.USER_COLLECTION).insertOne(userData).then((response)=>{
            resolve({status:true})
        })
        }
       
        
    })
     
   },

   doLogin:(userLogged)=>{
    return new Promise(async(resolve,reject)=>{
        let loginStatus = false
        let response={}
        let user = await db.get().collection(collection.USER_COLLECTION).findOne({email:userLogged.email})
        if(user){
           
            bcrypt.compare(userLogged.password,user.password).then((status)=>{
                if(status){
                    console.log('user blocked',user.block)
                    if(user.block){
                    
                        console.log('blocked')
                       
                        resolve({status:false})
                    }
                    else{
                        console.log('login success')
                        response.user = user
                        
                        response.status = true
                        resolve(response)
                    }
                   
                }else{
                    console.log('password wrong')
                    reject({status:true})
                }
            })
        }else{
            console.log('User Doesnt Exist')
            reject({status:false})  
        }

    })
   },

   checkPhone:(phoneData)=>{
    return new Promise(async(resolve,reject)=>{
        let response ={}
        let user = await db.get().collection(collection.USER_COLLECTION).findOne({phone:phoneData.phone})
        if(user){
            if(user.block){
                resolve({status:false})
            }
            else{
                resolve({status:true})
            }
        }else{
           reject({status:false}) 
        }
    })
   },

   addToCart:(prodID,userID)=>{
    let prodObj = {
        item: objectId(prodID),
        quantity: 1
    }
    return new Promise(async(resolve,reject)=>{
        let userCart = await db.get().collection(collection.CART_COLLECTION).findOne({user: objectId(userID)})
        if(userCart){
            let prodExist = userCart.products.findIndex(product=> product.item == prodID)
            console.log(prodExist);
            if(prodExist!=-1){
                db.get().collection(collection.CART_COLLECTION).updateOne(
                    {user:objectId(userID),'products.item':objectId(prodID)},
                    {$inc: {'products.$.quantity':1}}
                ).then((response)=>{
                    resolve()
                })
            }else{
                db.get().collection(collection.CART_COLLECTION).updateOne({user:objectId(userID)},{
                    $push:{
                        products: prodObj
                    }
                }).then((response)=>{
                   resolve()
                })
            }
             
        }
        else{
            let cartObj = {
                user: objectId(userID),
                products: [prodObj]
            }
            db.get().collection(collection.CART_COLLECTION).insertOne(cartObj).then((response)=>{
                resolve()
            })
        }
    })
   },

   getCart:(userID)=>{
    return new Promise(async(resolve,reject)=>{
        let cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
            {$match:{user: objectId(userID)}} ,
            {
                $unwind:'$products'
            },
            {
                $project:{
                    item:'$products.item',
                    quantity:'$products.quantity'
                }
            },
            {
                $lookup:{
                    from:collection.PRODUCT_COLLECTION,
                    localField:'item',
                    foreignField:'_id',
                    as:'cartItems'
                }
            },
            {
                $project:{
                    item:1,
                    quantity:1,
                    cartItems:{$arrayElemAt:['$cartItems',0]}
                }
            }

            // {$lookup:{
            //     from: collection.PRODUCT_COLLECTION,
            //     let:{prodList:'$products'},
            //     pipeline:[{
            //         $match:{
            //             $expr:{
            //                 $in:['$_id','$$prodList']
            //             }
            //         }
            //     }],
            //     as:'cartItems'
            // }}
        ]).toArray()
        // console.log(cartItems[2].cartItems)
        resolve(cartItems)
    })
   },

   getCartCount:(userID)=>{
    return new Promise(async(resolve,reject)=>{
        let count =0
       let cart= await db.get().collection(collection.CART_COLLECTION).findOne({user:objectId(userID)})
       if(cart){
        console.log(cart)
        count = cart.products.length
       }
       resolve(count)
    })
   },

   changeProductQuantity:(details)=>{
    details.count = parseInt(details.count)
    details.quantity = parseInt(details.quantity)
   
    return new Promise((resolve,reject)=>{
        if(details.count==-1 && details.quantity==1){
            db.get().collection(collection.CART_COLLECTION).updateOne(
                {_id:objectId(details.cart)},
                {
                    $pull:{products:{item:objectId(details.product)}}
                }
            ).then((response)=>{
                resolve({removeProduct:true})
            })
        }
        else{
            db.get().collection(collection.CART_COLLECTION).updateOne(
                {_id:objectId(details.cart),'products.item':objectId(details.product)},
                {$inc: {'products.$.quantity':details.count}}
            ).then((response)=>{
                resolve({status:true})
            })
        }
    })
   },

   deleteCartProduct:(details)=>{
    return new Promise((resolve,reject)=>{
        db.get().collection(collection.CART_COLLECTION).updateOne(
            {_id:objectId(details.cart)},
            {
                $pull:{products:{item:objectId(details.product)}}
            }
        ).then((response)=>{
            resolve({deleteProduct:true})
        })
    })

   },

   totalPrice:(userID)=>{
    return new Promise(async(resolve,reject)=>{
        let total = await db.get().collection(collection.CART_COLLECTION).aggregate([
            {$match:{user: objectId(userID)}} ,
            {
                $unwind:'$products'
            },
            {
                $project:{
                    item:'$products.item',
                    quantity:'$products.quantity'
                }
            },
            {
                $lookup:{
                    from:collection.PRODUCT_COLLECTION,
                    localField:'item',
                    foreignField:'_id',
                    as:'cartItems'
                }
            },
            {
                $project:{
                    item:1,
                    quantity:1,
                    cartItems:{$arrayElemAt:['$cartItems',0]}
                }
            },
            {
                $group:{
                    _id:null,
                    total:{ $sum:{ $multiply:['$quantity','$cartItems.price']}}
                }
            }
        ]).toArray()
        console.log(total)
        resolve(total[0].total)
    })
   },

   placeOrder:(order,products,total)=>{
    return new Promise((resolve,reject)=>{
        console.log(order,products,total);
        let status = order['payment-method'] ==='COD'? 'Placed':'Pending'
        let orderObj ={
            deliveryDetails:{
                mobile:order.mobile,
                address:order.address,
                pincode:order.pin,
                
            },
            userId: objectId(order.userID),
            paymentMethod:order['payment-method'],
            products:products,
            totalAmount:total,
            date: new Date(),
            status:status
        }
        db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj).then((response)=>{
            db.get().collection(collection.CART_COLLECTION).deleteOne({user:objectId(order.userID)})
            resolve()
        })
   })

   },

   
    getCartProductList:(userID)=>{
        return new Promise(async(resolve,reject)=>{
            let cart = await db.get().collection(collection.CART_COLLECTION).findOne({user:objectId(userID)})
            resolve(cart.products)
            
        })
    },

    getOrderDetails:(userID)=>{
        return new Promise(async(resolve,reject)=>{
            let orderList = await db.get().collection(collection.ORDER_COLLECTION).find({userId:objectId(userID)}).sort({_id:-1}).toArray()
            console.log(orderList[0])
            resolve(orderList)

        })
    },

    getOrderProductDetails:(orderID)=>{
        return new Promise(async(resolve,reject)=>{
            let orderProductList = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {$match:{_id:objectId(orderID)}},

                {$unwind:'$products'},

                {$project:{
                    item:'$products.item',
                    quantity:'$products.quantity',
                    address:'$deliveryDetails.address',
                    status:'$status',
                    date:'$date',
                    total:'$totalAmount'
                }},

                {$lookup:{
                    from:collection.PRODUCT_COLLECTION,
                    localField:'item',
                    foreignField:'_id',
                    as:'orderProducts'
                }},

                {$project:{
                    item:1,
                    quantity:1,
                    address:1,
                    status:1,
                    date:1,
                    total:1,
                    orderProduct:{$arrayElemAt:['$orderProducts',0]}
                }}

                
            ]).toArray()
            console.log(orderProductList[0])
            resolve(orderProductList)
        })
    },

   
}