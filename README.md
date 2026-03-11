
---

# 易宿酒店预订平台接口文档

> 注：全部接口均使用 `JSON` 格式传参和返回，HTTP 状态码遵循 RESTful 规范，`200 OK` 表示成功，`4xx` 表示客户端错误，`5xx` 表示服务端错误。
---

### 登录注册
```
登录的请求体见接口的详情。
注册的请求体:
{
    username: "";
    password:"";
    role: "admin"; 或者 "merchant"
}


```

## 1. 用户端接口

### 1.1 酒店列表查询接口

:::check[已完成]
后端提供上线的酒店数据，排序以及筛选也由后端完成
:::

**接口说明：**
获取指定条件下的酒店列表，用于用户端首页/列表页展示。

| 字段           | 类型                 | 是否必填 | 说明                                        |
| ------------ | ------------------ | ---- | ----------------------------------------- |
| city         | string             | 否    | 城市名称，模糊匹配                                 |
| keyword      | string             | 否    | 酒店名称、商圈、地标关键字                             |
| check_in     | string（yyyy-MM-dd） | 是    | 入住日期                                      |
| check_out    | string（yyyy-MM-dd） | 是    | 离店日期                                      |
| star_min     | int                | 否    | 最小星级                                      |
| star_max     | int                | 否    | 最大星级                                      |
| price_min    | int                | 否    | 最低价格                                      |
| price_max    | int                | 否    | 最高价格                                      |
| facility_ids | array[int]         | 否    | 设施筛选，例如 [1,2,3]                           |
| sort         | string             | 否    | 排序规则：price_asc / price_desc / rating_desc |

**请求示例：**

```json
GET /api/hotels?city=北京&check_in=2026-02-01&check_out=2026-02-03&star_min=3&sort=price_asc
```

**返回体示例：**

```json
{
  "code": 200,
  "message": "成功",
  "data": [
    {
      "hotel_id": 101,
      "name": "易宿国际酒店",
      "star": 4,
      "rating": 4.5,
      "review_count": 102,
      "address": "北京市朝阳区XX路100号",
      "opening_date": "2024",
      "latitude": 39.903,
      "longitude": 116.401,
      "cover_image": "http://xxx.com/image1.jpg",
      "lowest_price": 480,
      "facilities": ["免费停车","健身房"]
    },
    {
      "hotel_id": 102,
      "name": "易宿精品酒店",
      "star": 3,
      "rating": 4.2,
      "review_count": 56,
      "address": "北京市海淀区YY路88号",
      "opening_date": "2025",
      "latitude": 39.912,
      "longitude": 116.398,
      "cover_image": "http://xxx.com/image2.jpg",
      "lowest_price": 320,
      "facilities": ["免费WiFi","早餐"]
    }
  ]
}
```

---

### 1.2 酒店详情接口

**接口说明：**
获取酒店完整信息及房型价格，用于详情页展示。

**请求参数：**

| 字段        | 类型     | 是否必填 | 说明   |
| --------- | ------ | ---- | ---- |
| hotel_id  | int    | 是    | 酒店ID |
| check_in  | string | 是    | 入住日期 |
| check_out | string | 是    | 离店日期 |

**请求示例：**

```json
GET /api/hotel/101?check_in=2026-02-01&check_out=2026-02-03
```

**返回体示例：**

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "hotel_id": 101,
    "name": "易宿国际酒店",
    "star": 4,
    "rating": 4.5,
    "review_count": 102,
    "address": "北京市朝阳区XX路100号",
    "opening_date": "2024",
    "description": "酒店简介...",
    "contacts": [
      {
        "type": "phone",
        "value": "010-88888888",
        "is_primary": true,
        "remark": "前台电话"
      },
      {
        "type": "email",
        "value": "service@hotel.com",
        "is_primary": false
      }
    ],
    "images": [
      {"url":"http://xxx.com/img1.jpg","type":"cover"},
      {"url":"http://xxx.com/img2.jpg","type":"detail"}
    ],
    "facilities": ["免费停车","健身房","WiFi"],
    "rooms": [
      {
        "room_id": 1001,
        "name": "高级大床房",
        "area": 28,
        "bed_type": "1.8米大床",
        "max_guest": 2,
        "price_detail": [
          {"date":"2026-02-01","price":480,"stock":2},
          {"date":"2026-02-02","price":500,"stock":3}
        ]
      }
    ],
    "promotions": [
      {
        "promotion_id": 201,
        "source": "platform",
        "type": "discount",
        "discount": 0.8,
        "description": "春节特惠 8 折"
      }
    ]
  }
}

```

📌 说明：

* `promotions` 结合 `promotion_scene` 和 `holiday_calendar` 自动筛选当前可用优惠；
* 价格计算顺序：**商户优惠 → 平台优惠 → 最终价格**；
* `price_detail` 显示每天的房价和库存，支持日期选择。

---

### 1.3 酒店评论接口

**请求参数：**

| 字段       | 类型  | 是否必填 | 说明         |
| -------- | --- | ---- | ---------- |
| hotel_id | int | 是    | 酒店ID       |
| page     | int | 否    | 页码，默认 1    |
| size     | int | 否    | 每页数量，默认 10 |

**返回示例：**

```json
{
  "code": 200,
  "message": "成功",
  "data": {
    "total": 120,
    "reviews": [
      {
        "review_id": 501,
        "user_id": 301,
        "username": "张三",
        "rating": 5,
        "content": "环境很好，服务到位",
        "created_at": "2026-01-25 12:34:56"
      }
    ]
  }
}
```

---

## 2. 商户端接口

### 2.1 酒店管理接口

**新增酒店** 

:::check[已完成]
bugfix:新增酒店要同时增加房型
:::
```json
POST /api/merchant/hotel
{
  "name": "厦门鼓浪屿海景民宿",
  "hotel_type": "guesthouse",
  "star": 3,
  "city": "中国·厦门",
  "address": "福建省厦门市思明区鼓浪屿龙头路66号",
  "latitude": 24.4480,
  "longitude": 118.0655,
  "description": "步行可达海边，环境安静，适合度假与情侣出行。",
  "opening_date": "2020-04-18",
  "contacts": [
    {
      "type": "phone",
      "value": "0592-8888999",
      "is_primary": true
    }
  ],
  "facilities": [2, 6, 9],
  "images": [
    {
      "url": "https://images.unsplash.com/photo-1505691938895-1758d7feb511",
      "type": "cover"
    },
    {
      "url": "https://images.unsplash.com/photo-1501117716987-c8e1ecb210df",
      "type": "detail"
    }
  ],
  "rooms": [
    {
      "name": "海景大床房",
      "area": 40,
      "bed_type": "大床",
      "max_guest": 2,
      "base_price": 560,
      "stock": 4,
      "images": [
        {
          "url": "https://images.unsplash.com/photo-1584132967334-10e028bd69f7",
          "type": "cover"
        },
        {
          "url": "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2",
          "type": "detail"
        }
      ],
      "tag_ids": [2, 4, 5]
    },
    {
      "name": "庭院双床房",
      "area": 32,
      "bed_type": "双床",
      "max_guest": 2,
      "base_price": 420,
      "stock": 6,
      "images": [
        {
          "url": "https://images.unsplash.com/photo-1559599101-f09722fb4948",
          "type": "cover"
        },
        {
          "url": "https://images.unsplash.com/photo-1578683010236-d716f9a3f461",
          "type": "detail"
        }
      ],
      "tag_ids": [1, 3]
    },
    {
      "name": "家庭亲子套房",
      "area": 55,
      "bed_type": "一大一小床",
      "max_guest": 3,
      "base_price": 680,
      "stock": 3,
      "images": [
        {
          "url": "https://images.unsplash.com/photo-1591088398332-8a7791972843",
          "type": "cover"
        },
        {
          "url": "https://images.unsplash.com/photo-1560185127-6ed189bf02f4",
          "type": "detail"
        }
      ],
      "tag_ids": [2, 5]
    }
  ]
}


```

**返回示例：**

```json
{
  "code": 200,
  "message": "酒店创建成功",
  "data": {"hotel_id": 101}
}
```
注意：酒店的设施是管理员设置好的标签，商户需要勾选设施。facilities[1,2,3]

---

#### 获取当前商户的酒店详情（用于编辑页回填）
说明：仅能查询本商户的酒店；用于「编辑酒店」页回填表单。
:::check[已完成]

:::
```json
GET /api/merchant/hotel/:id
{
  "code": 200,
  "message": "成功",
  "data": {
    "hotel_id": 101,
    "name": "易宿国际酒店",
    "star": 4,
    "city": "北京",
    "address": "朝阳区XX路100号",
    "latitude": 39.903,
    "longitude": 116.401,
    "description": "酒店简介",
    "opening_date": "2024",
    "status": "approved",
    "contacts": [...],
    "facilities": [1, 2, 3],
    "images": [...]
  }
}

```

好的，我把你提供的接口文档整理成 **Markdown 格式**，便于在文档或 README 中使用：

---

### 提交酒店信息修改（待管理员审核）


:::check[已完成]

:::
**说明**：
已审核并上线的酒店，商户不能直接修改 `hotel` 表。商户提交修改后，写入 `hotel_edit` 表，`edit_status = pending`，由管理员审核。审核通过前，用户端仍展示 `hotel` 表原数据。

---

#### 请求信息

* **方法/路径**：`POST /api/merchant/hotel/:id/edit`
* **Content-Type**：`application/json`
* **鉴权**：Header `Authorization: Bearer <商户 token>`

#### 路径参数

| 参数 | 类型     | 必填 | 说明             |
| -- | ------ | -- | -------------- |
| id | number | 是  | 酒店 ID，须为本商户的酒店 |

#### 请求体

仅传需要修改的字段（与新增酒店字段一致，均可选；未传字段表示不修改）

| 字段           | 类型         | 必填 | 说明                                                   |             |
| ------------ | ---------- | -- | ---------------------------------------------------- | ----------- |
| name         | string     | 否  | 修改后的酒店名称                                             |             |
| star         | int        | 否  | 修改后的星级（1-5）                                          |             |
| city         | string     | 否  | 修改后的城市                                               |             |
| address      | string     | 否  | 修改后的地址                                               |             |
| latitude     | number     | 否  | 修改后的纬度                                               |             |
| longitude    | number     | 否  | 修改后的经度                                               |             |
| description  | string     | 否  | 修改后的介绍                                               |             |
| opening_date | string     | 否  | 修改后的开业日期（如 "2024" 或 "2024-01-01"）                    |             |
| contacts     | array      | 否  | 修改后的联系方式（全量覆盖），项结构同「新增酒店」                            |             |
| facilities   | array[int] | 否  | 修改后的设施 ID 列表（全量覆盖），如 `[1,2,3]`                       |             |
| images       | array      | 否  | 修改后的图片列表（全量覆盖），项结构：`{ "url": string, "type": "cover" | "detail" }` |

#### 请求体示例

```json
{
  "name": "易宿国际酒店（新名）",
  "address": "朝阳区YY路200号",
  "description": "更新后的简介"
}
```

---

#### 返回示例

#### 成功（200）

```json
{
  "code": 200,
  "message": "修改已提交，等待管理员审核",
  "data": {
    "hotel_edit_id": 1
  }
}
```

#### 错误

* `400`：酒店 ID 无效；或「仅已上线的酒店可提交修改」；或「已有待审核修改，请等待审核结果」。
* `403`：酒店不存在或无权操作。

---

#### 业务规则

1. 仅允许对 **本商户** 且 **已上线（status = approved）** 的酒店提交修改；草稿、待审核、已下线、已驳回等状态不可提交。
2. 若该酒店已存在一条 `edit_status = pending` 的 `hotel_edit` 记录，接口返回 `400`，提示「已有待审核修改，请等待审核结果」，不新建也不覆盖记录。


#### 注意：这里存在一个问题
---

#### 酒店信息修改审核问题与解决方案

#### 问题描述

商户提交酒店信息修改时，如果只修改了部分字段，`hotel_edit` 表中其他字段会为空，如下图所示：

![image.png](https://api.apifox.com/api/v1/projects/7784381/resources/620277/image-preview)

管理员在审核时，需要明确哪些字段被修改，以便正确判断和审核。

---

#### 解决方案

#### 前端处理

1. **获取原始酒店信息**
   使用 `hotel_id`（或从列表点击某条审核时的 `hotel_edit_id`）调用接口：

   ```text
   GET /api/.../hotel/:hotel_id
   ```

   或使用已有管理员侧酒店详情接口获取当前酒店数据。

2. **获取待审核修改信息**
   调接口获取该酒店的待审核修改记录：

   ```text
   GET /api/admin/hotel/edit/:id（:id 为 hotel_edit 的 id）
   ```



3. **前端生成对比**

   * 对比两条数据（`hotel` 与 `hotel_edit`）
   * 对每个字段，若 `hotel_edit` 中该字段非 `null`/非空，则认为该字段有变更
   * 在页面上展示：

     ```
     原值（来自 hotel） → 新值（来自 hotel_edit）
     ```

4. **判断变化并展示**

   * 变化字段生成对比列表
   * 前端负责展示和标记变更

---

#### 小结

| 角色 | 责任                                                                           |
| -- | ---------------------------------------------------------------------------- |
| 后端 | 仅新增「获取 hotel_edit」的接口（按 `hotel_edit_id` 或按 `hotel_id` 获取 pending 一条），不负责计算对比 |
| 前端 | 根据 `hotel_id` 查询 `hotel` + `hotel_edit`，对比找出有变化的字段并展示给管理员                    |

**理解要点**：

* 后端只提供数据接口
* 对比逻辑和展示完全由前端处理

---


:::warning[商户编辑酒店信息--逻辑修改]
1. 商户修改酒店信息后，将整个表单都保存到编辑表中（之前是只保存修改的部分）。供管理员审核。这个未解决。
2. 商户修改后的信息，待审核状态，需要能查看到自己提交修改的表单信息
:::



---
### 2.2 房型管理接口

**新增房型**

:::check[已完成]

:::

```json
POST /api/merchant/hotel/101/room
{
  "name": "高级大床房",
  "area": 28,
  "bed_type": "大床",
  "max_guest": 2,
  "base_price": 500,
  "stock": 10
}
```

**返回示例：**

```json
{
  "code": 200,
  "message": "房型创建成功",
  "data": {"room_id": 1001}
}
```

---

### 2.3 优惠管理接口（商户可创建自己的优惠）
:::check[已完成]

:::
```json
POST /api/merchant/hotel/101/promotion
{
  "type": "discount",
  "discount": 0.85,
  "minus": null,
  "description": "春节商户专享 8.5 折",
  "start_time": "2026-02-01T00:00:00",
  "end_time": "2026-02-10T23:59:59",
  "scenes": ["holiday","weekend"]
}
```

**返回示例：**

```json
{
  "code": 200,
  "message": "优惠创建成功",
  "data": {"promotion_id": 301}
}
```

---

## 3. 管理员端接口

### 3.1 酒店审核列表

:::check[已完成]

:::
前端可以获取全部的内容，包括新酒店的审核和修改后的审核、已发布的、已下线的这些。。每条记录信息都添加一个标签代表这个记录的类别，筛选的话交给前端来筛选，根据这个标签，但是待审核的需要包括新酒店的审核和修改后的审核。

获取全部的列表数据
```json
GET /api/admin/hotels/list
GET /api/admin/hotels/list?page=1&size=10
```
项目	说明
路径	GET /api/admin/hotels/list?page=1&size=10
返回	data: { list, total, page, size }，list 每项含 type、hotel_id、hotel_edit_id、name、merchant_id、status、created_at
分页	page 默认 1，size 默认 10、最大 100；total 为合并后总条数

type 与前端标签对应：
type	含义
hotel_pending	新酒店待审核
hotel_edit_pending	酒店信息修改待审核
hotel_approved	已发布
hotel_offline	已下线
hotel_rejected	酒店已驳回
hotel_edit_rejected	酒店信息修改已驳回
hotel_draft / hotel_editing	草稿 / 编辑中（若有）


**返回示例：**

```json
{
    "code": 200,
    "message": "成功",
    "data": {
        "list": [
            {
                "type": "hotel_edit_pending",
                "hotel_id": 3,
                "hotel_edit_id": 1,
                "name": "易宿国际酒店2222",
                "merchant_id": 1,
                "status": "pending",
                "created_at": "Sun Feb 01 2026 21:00:23 GMT+0800 (中国标准时间)"
            },
            {
                "type": "hotel_approved",
                "hotel_id": 3,
                "hotel_edit_id": null,
                "name": "易宿国际酒店2222",
                "merchant_id": 1,
                "status": "approved",
                "created_at": "Sun Feb 01 2026 20:17:04 GMT+0800 (中国标准时间)"
            },
            {
                "type": "hotel_pending",
                "hotel_id": 2,
                "hotel_edit_id": null,
                "name": "易宿国际酒店",
                "merchant_id": 1,
                "status": "pending",
                "created_at": "Sun Feb 01 2026 13:15:12 GMT+0800 (中国标准时间)"
            }
        ],
        "total": 3,
        "page": 1,
        "size": 10
    }
}
```




### 管理端-管理员获取单条 hotel_edit（用于审核页对比）

:::check[已完成]

:::
```json
GET api/admin/hotel/edit/id
{
    "code": 200,
    "message": "成功",
    "data": {
        "id": 1,
        "hotel_id": 3,
        "name": "易宿国际酒店（新名）",
        "star": null,
        "city": null,
        "address": "朝阳区YY路200号",
        "latitude": null,
        "longitude": null,
        "description": "更新后的简介",
        "opening_date": null,
        "edit_status": "pending",
        "reject_reason": null,
        "created_at": "Sun Feb 01 2026 21:00:23 GMT+0800 (中国标准时间)",
        "reviewed_at": null,
        "contacts_edit": null,
        "facilities_edit": null,
        "images_edit": null
    }
}
```


---

明白了，你希望保留**思路和方案**，去掉具体接口名称和实现细节，让文档更清晰、条理化，方便理解和设计。下面我帮你整理成更简洁、逻辑清楚的版本：

---

# 管理员审核：问题与解决方案

## 一、问题背景

1. **两类待审核混在一起**
   系统中有两类内容需要管理员审核：

   * **新酒店审核**：商户新建酒店，决定是否上线。
   * **酒店信息修改审核**：已上线酒店，商户提交修改，决定是否生效。
     如果不区分，管理员可能不清楚当前处理的是新酒店还是某次信息修改，审核列表和操作逻辑会混乱。

2. **部分修改导致 hotel_edit 中大量 NULL**
   商户提交修改时，只会记录变更字段，其余字段为 NULL。
   管理员直接查看 `hotel_edit` 记录时，会看到很多空字段，难以判断哪些字段被修改，以及修改前后的值。

---

## 二、解决思路

### 1. 审核入口与流程分开

* **新酒店审核**：针对酒店是否允许上线。
* **信息修改审核**：针对已上线酒店的字段修改是否生效。

**设计原则**：

* 两类审核在管理员端应有不同入口或列表。
* 每类审核独立管理，逻辑清晰、职责单一。
* 审核时只关注对应业务含义：新酒店是否上线、修改是否生效。

---

### 2. 对 hotel_edit 中 NULL 的处理与展示

* **设计约定**：NULL 表示该字段未修改，不覆盖原值。
* **审核展示**：管理员只需看到有变更的字段及其「原值 → 新值」。

**实现思路**：

* **方式 A：后端生成对比**

  * 后端接口直接返回有变化的字段列表（字段名 + 原值 + 新值），前端直接展示。
* **方式 B：前端生成对比**

  * 后端提供当前酒店信息和 `hotel_edit` 记录。
  * 前端比对两者的字段，筛选出非 NULL 的修改项生成对比视图。

> 不需要也不应把 `hotel_edit` 中的 NULL 填满，只需展示变更字段即可。

---

## 三、审核流程建议

1. **新酒店审核**

   * 管理员查看待审核新酒店列表
   * 点击进入详情，判断是否允许上线
   * 审核通过则酒店状态变为已上线

2. **信息修改审核**

   * 管理员查看待审核修改列表
   * 点击进入详情，对比变更字段（「原值 → 新值」）
   * 审核通过则将 `hotel_edit` 中非 NULL 字段写回酒店表，同时更新相关子表（如联系方式、设施、图片）

---

## 四、总结

| 问题                      | 解决方案                            |
| ----------------------- | ------------------------------- |
| 两类待审核易混淆                | 管理员端分为两个入口/列表，分别处理新酒店和信息修改      |
| hotel_edit 大量 NULL 难以判断 | 约定 NULL = 未修改；只展示有变更字段，通过对比视图呈现 |
| 审核时需要原值                 | 前端或后端生成「原值 → 新值」对比，不修改未变更字段     |

**核心思想**：

* 审核职责清晰、入口分明
* 管理员只关注变化字段
* 不破坏原有数据，只处理实际修改

---

![image.png](https://api.apifox.com/api/v1/projects/7784381/resources/620278/image-preview)


---

### 3.2 审核操作


```json
酒店审核（新酒店）
POST /api/admin/hotel/:hotel_id/audit	
Body：{ "result": "approved" | "rejected", "reason": "" }	
通过：hotel.status=approved，写 hotel_audit；
驳回：hotel.status=rejected，写 hotel_audit

酒店信息修改审核
POST /api/admin/hotel/edit/:hotel_edit_id/audit
```

**返回示例：**

```json
{
  "code": 200,
  "message": "审核成功"
}
```

如果管理员审核通过，直接更新到线上
**如果审核不通过，拒绝信息在hotel_edit表中。商户需要查看拒绝的信息。因此需要新加接口获取这个拒绝的信息**
**商户需要展示酒店列表：只展示当前商户的酒店，每条带状态（待审核 / 已上线 / 已下线 / 已驳回 / 有修改被驳回 / 有修改待审核 等）
点进某家酒店：进酒店详情/编辑页，能看到当前酒店信息 + 该酒店最近的修改记录（含驳回原因）。
被驳回时：展示当时提交的修改内容 + 驳回原因，支持在原有基础上改完再次提交（走现有「提交修改」接口）**

### 商户酒店列表

:::check[已完成]

:::
```json
GET /api/merchant/hotels?page=1&size=10
Header：Authorization: Bearer <商户 token>
返回：
{
    "code": 200,
    "message": "成功",
    "data": {
        "list": [
            {
                "hotel_id": 9,
                "name": "酒店777",
                "status": "approved",
                "created_at": "Wed Feb 04 2026 09:39:07 GMT+0800 (中国标准时间)"
            },
}
```

### 新增【该酒店最近一条修改记录】接口

:::check[已完成]

:::
```json
GET /api/merchant/hotel/:id/edit/latest
:id = hotel_id（与详情接口一致）
{
    "code": 200,
    "message": "成功",
    "data": {
        "hotel_edit_id": 2,
        "hotel_id": 3,
        "edit_status": "rejected",
        "reject_reason": "补充简介",
        "reviewed_at": "Sat Feb 07 2026 19:12:01 GMT+0800 (中国标准时间)",
        "created_at": "Sat Feb 07 2026 19:01:41 GMT+0800 (中国标准时间)",
        "name": "易宿国际酒店（新名2）",
        "star": null,
        "city": null,
        "address": "朝阳区YY路200号",
        "latitude": null,
        "longitude": null,
        "description": "更新后的简介2222222222",
        "opening_date": null,
        "contacts_edit": null,
        "facilities_edit": null,
        "images_edit": null
    }
}
```
```json
前端逻辑（点击列表中的酒店后）【注意，修改信息后的酒店项 要在列表中加个label（有修改）】
从列表带 hotel_id 进入详情/编辑页（例如 /merchant/hotel/:id 或 /merchant/hotel/:id/edit）。
调用 GET /api/merchant/hotel/:id 获取当前酒店详情（表单默认用这份数据）。
调用 GET /api/merchant/hotel/:id/edit/latest获取最近一次修改记录。

始终展示：当前酒店信息（名称、地址、联系方式、设施、图片等），可用作表单初始值。

若存在 latest_edit 且 edit_status === 'rejected'：
在页面顶部或表单上方展示提示，例如：「您的修改未通过审核」；
展示 reject_reason（驳回原因）、reviewed_at（审核时间）；
【可选：用 latest_edit 里当时提交的字段（name、address、contacts_edit 等）做「您上次提交的内容」展示，或直接作为表单的预填值，方便商户在「上次提交的基础上」改完再提交。】

若 edit_status === 'pending'：
提示「您有一条修改正在审核中」，并可禁用或限制再次提交（你后端已有「存在 pending 则不允再次提交」的规则，前端可配合禁用提交按钮）。

商户改完表单后，仍用现有接口：POST /api/merchant/hotel/:id/edit，body 为本次要提交的修改字段。
提交成功后，可返回列表或刷新详情，并再次拉取 edit/latest，若新记录变为 pending，则展示「审核中」；若再次被驳回，则继续展示驳回原因和最新提交内容。
```


---

:::check[已完成]
在审核之前需要做的准备工作，管理员点击审核的酒店时，需要获取信息，
1. 新审核的酒店
需要拉取酒店详情展示，因此需要写管理端获取酒店详情的接口：
```json
GET /api/admin/hotel/:id
```

2. 信息修改审核的酒店 
拉取当前酒店详情，和 hotel_edit 做对比
```json
GET api/admin/hotel/edit/id (这个上面已经完成了，这里只提供接口，对比是前端的事情)

:::

---

### 3.3 平台优惠管理接口

```json
POST /api/admin/promotion
{
  "hotel_id": null,
  "type": "minus",
  "discount": null,
  "minus": 100,
  "description": "国庆平台补贴 100 元",
  "start_time": "2026-10-01T00:00:00",
  "end_time": "2026-10-07T23:59:59",
  "scenes": ["holiday"]
}
```

**返回示例：**

```json
{
  "code": 200,
  "message": "平台优惠创建成功",
  "data": {"promotion_id": 401}
}
```
#### 管理员上传酒店设施表供商户勾选
```json
POST /api/merchant/facility
{
    "name": "免费晚餐"
{
```
---

## 4. 公共能力接口

### 4.1 节假日列表查询


:::check[已完成]

:::

```json
GET /api/holiday_calendar
```

**返回示例：**

```json
{
  "code": 200,
  "message": "成功",
  "data": [
    {"date":"2026-01-25","name":"春节","type":"legal"},
    {"date":"2026-10-01","name":"国庆节","type":"legal"}
  ]
}
```

---

### 4.2 酒店周边兴趣点查询

```json
GET /api/hotel/101/poi
```

:::check[已完成]

:::
**返回示例：**

```json
{
  "code": 200,
  "message": "成功",
  "data": [
    {"poi_id":501,"name":"天安门","type":"scenic","distance":1200},
    {"poi_id":502,"name":"地铁站A","type":"traffic","distance":800}
  ]
}
```

### 4.3 根据address位置获取经纬度

```json
GET /api/getGeoLocation
```

:::check[已完成]

:::

![image.png](https://api.apifox.com/api/v1/projects/7784381/resources/625506/image-preview)
**返回示例：**

```json
{
    "code": 200,
    "message": "成功",
    "data": {
        "status": "1",
        "info": "OK",
        "infocode": "10000",
        "count": "1",
        "geocodes": [
            {
                "formatted_address": "北京市",
                "country": "中国",
                "province": "北京市",
                "citycode": "010",
                "city": "北京市",
                "district": [],
                "township": [],
                "neighborhood": {
                    "name": [],
                    "type": []
                },
                "building": {
                    "name": [],
                    "type": []
                },
                "adcode": "110000",
                "street": [],
                "number": [],
                "location": "116.407387,39.904179",
                "level": "省"
            }
        ]
    }
}
```

### 4.4 根据经纬度获取位置

:::check[已完成]
这个接口需要携带参数，参数是经纬度，需要在前端使用navigator.geolocation插件来获取经纬度。调用这个接口携带这两个参数，接口就会返回用户当前的位置信息。
:::
```
GET /api/getCurrentLocation
```
需要携带参数
![image.png](https://api.apifox.com/api/v1/projects/7784381/resources/625694/image-preview)
返回体：
```json
{
    "code": 200,
    "message": "成功",
    "data": {
        "status": "1",
        "regeocode": {
            "roads": [
                {
                    "id": "0370I50F01901348",
                    "location": "115.638,34.4435",
                    "direction": "北",
                    "name": "货场路",
                    "distance": "238.041"
                },
                {
                    "id": "0370I50F019014380",
                    "location": "115.634,34.4457",
                    "direction": "东",
                    "name": "长征路",
                    "distance": "314.024"
                },
                {
                    "id": "0370I50F019014726",
                    "location": "115.638,34.4415",
                    "direction": "北",
                    "name": "民主中路",
                    "distance": "452.869"
                }
            ],
            "roadinters": [
                {
                    "second_name": "长征路",
                    "first_id": "0370I50F01901348",
                    "second_id": "0370I50F019014380",
                    "location": "115.633801,34.444792",
                    "distance": "369.302",
                    "first_name": "货场路",
                    "direction": "东"
                }
            ],
            "formatted_address": "河南省商丘市梁园区长征街道货场路43号瑞博花园",
            "addressComponent": {
                "city": "商丘市",
                "province": "河南省",
                "adcode": "411402",
                "district": "梁园区",
                "towncode": "411402002000",
                "streetNumber": {
                    "number": "43号",
                    "location": "115.637984,34.444960",
                    "direction": "东南",
                    "distance": "75.1598",
                    "street": "货场路"
                },
                "country": "中国",
                "township": "长征街道",
                "businessAreas": [
                    {
                        "location": "115.650811,34.435596",
                        "name": "团结路商业街",
                        "id": "411402"
                    }
                ],
                "building": {
                    "name": [],
                    "type": []
                },
                "neighborhood": {
                    "name": [],
                    "type": []
                },
                "citycode": "0370"
            },
            "aois": [
                {
                    "area": "33567.890338",
                    "type": "120302",
                    "id": "B0FFG9K1SP",
                    "location": "115.638631,34.446456",
                    "adcode": "411402",
                    "name": "瑞博花园",
                    "distance": "5.14581"
                }
            ],
            "pois": [
                {
                    "id": "B0FFG9K1SP",
                    "direction": "东北",
                    "businessarea": "团结路商业街",
                    "address": "长征路与货场路交叉口东440米",
                    "poiweight": "0.228583",
                    "name": "瑞博花园",
                    "location": "115.638631,34.446456",
                    "distance": "127.683",
                    "tel": [],
                    "type": "商务住宅;住宅区;住宅小区"
                },
                {
                    "id": "B017202OBT",
                    "direction": "西南",
                    "businessarea": "团结路商业街",
                    "address": "货场东路",
                    "poiweight": "0.175471",
                    "name": "物华新苑",
                    "location": "115.636227,34.444093",
                    "distance": "215.4",
                    "tel": [],
                    "type": "商务住宅;住宅区;住宅小区"
                },
                {
                    "id": "B0FFFP6T3G",
                    "direction": "东南",
                    "businessarea": "团结路商业街",
                    "address": "货场路41号",
                    "poiweight": "0.228643",
                    "name": "农百新区",
                    "location": "115.639378,34.444768",
                    "distance": "178.748",
                    "tel": [],
                    "type": "商务住宅;住宅区;住宅小区"
                },
                {
                    "id": "B0FFFFYGVY",
                    "direction": "南",
                    "businessarea": "团结路商业街",
                    "address": "货场路63附近",
                    "poiweight": "0.130961",
                    "name": "商丘市梁园区长征街道货场东路社区居民委员会",
                    "location": "115.637609,34.443639",
                    "distance": "217.894",
                    "tel": [],
                    "type": "政府机构及社会团体;政府机关;乡镇以下级政府及事业单位"
                },
                {
                    "id": "B0ID7CEMQ6",
                    "direction": "东南",
                    "businessarea": "团结路商业街",
                    "address": "气象局西侧",
                    "poiweight": "0.164819",
                    "name": "立邦防水美缝(货场路店)",
                    "location": "115.638703,34.443621",
                    "distance": "237.887",
                    "tel": "15993964846",
                    "type": "购物服务;家居建材市场;家居建材市场"
                },
                {
                    "id": "B0FFFFYWKU",
                    "direction": "东南",
                    "businessarea": "团结路商业街",
                    "address": "货场东路125号水利局",
                    "poiweight": "0.154639",
                    "name": "商丘市梁园区水政监察大队",
                    "location": "115.639622,34.444104",
                    "distance": "241.594",
                    "tel": [],
                    "type": "政府机构及社会团体;政府机关;区县级政府及事业单位"
                },
                {
                    "id": "B0FFFFYWKR",
                    "direction": "东南",
                    "businessarea": "团结路商业街",
                    "address": "货场东路125号梁园区水利局附近",
                    "poiweight": "0.175883",
                    "name": "梁园分局水利派出所",
                    "location": "115.639645,34.444349",
                    "distance": "225.415",
                    "tel": [],
                    "type": "政府机构及社会团体;公检法机构;公安警察"
                },
                {
                    "id": "B0FFFE8QB8",
                    "direction": "东南",
                    "businessarea": "团结路商业街",
                    "address": "中国农业银行(货场路北)",
                    "poiweight": "0.10798",
                    "name": "商丘市梁园区畜牧兽医执法大队",
                    "location": "115.639205,34.443836",
                    "distance": "239.121",
                    "tel": [],
                    "type": "政府机构及社会团体;政府机关;区县级政府及事业单位"
                },
                {
                    "id": "B0GK7C196O",
                    "direction": "南",
                    "businessarea": "团结路商业街",
                    "address": "货场路北侧",
                    "poiweight": "0.132195",
                    "name": "货场社区党群服务中心",
                    "location": "115.637737,34.443617",
                    "distance": "220.161",
                    "tel": [],
                    "type": "政府机构及社会团体;政府机关;乡镇以下级政府及事业单位"
                },
                {
                    "id": "B0FFHUUQ5N",
                    "direction": "南",
                    "businessarea": "团结路商业街",
                    "address": "物华新苑南门东70米",
                    "poiweight": "0.205418",
                    "name": "金天龙床具(物华新苑店)",
                    "location": "115.637012,34.443593",
                    "distance": "231.759",
                    "tel": "13781569758;13837073346",
                    "type": "购物服务;家居建材市场;家具城"
                },
                {
                    "id": "B0FFFFYGVT",
                    "direction": "南",
                    "businessarea": "团结路商业街",
                    "address": "物华新苑南门东70米",
                    "poiweight": "0.210808",
                    "name": "进财钢木家具(物华新苑店)",
                    "location": "115.637083,34.443569",
                    "distance": "232.653",
                    "tel": "13598368846;13781436869",
                    "type": "购物服务;家居建材市场;家具城"
                },
                {
                    "id": "B0J2AZ4B46",
                    "direction": "西南",
                    "businessarea": "团结路商业街",
                    "address": "物华新苑南门旁",
                    "poiweight": "0.175611",
                    "name": "富达家具(物华新苑店)",
                    "location": "115.636149,34.443489",
                    "distance": "274.541",
                    "tel": "15939055737",
                    "type": "购物服务;家居建材市场;家具城"
                },
                {
                    "id": "B0G29CQ0G2",
                    "direction": "南",
                    "businessarea": "团结路商业街",
                    "address": "物华新苑南门东70米",
                    "poiweight": "0.164087",
                    "name": "双木家具(物华新苑店)",
                    "location": "115.637071,34.443554",
                    "distance": "234.54",
                    "tel": "15896969319;15993989803",
                    "type": "购物服务;家居建材市场;家具城"
                },
                {
                    "id": "B0GRC1F15T",
                    "direction": "东南",
                    "businessarea": "团结路商业街",
                    "address": "农业技术推广中心西侧",
                    "poiweight": "0.163991",
                    "name": "美亿嘉家具工厂直营店",
                    "location": "115.638552,34.443711",
                    "distance": "223.508",
                    "tel": "17719023531;18937099549",
                    "type": "购物服务;家居建材市场;家居建材市场"
                },
                {
                    "id": "B0FFFXMCUS",
                    "direction": "东南",
                    "businessarea": "团结路商业街",
                    "address": "农业技术推广中心东侧",
                    "poiweight": "0.175547",
                    "name": "鑫海环保床垫",
                    "location": "115.639162,34.443800",
                    "distance": "240.205",
                    "tel": "13037565708;13233886861",
                    "type": "购物服务;家居建材市场;家具城"
                },
                {
                    "id": "B0FFFFYGVV",
                    "direction": "南",
                    "businessarea": "团结路商业街",
                    "address": "农百小区西侧140米",
                    "poiweight": "0.130961",
                    "name": "中共货场东路社区总支部委员会",
                    "location": "115.637704,34.443555",
                    "distance": "227.034",
                    "tel": [],
                    "type": "政府机构及社会团体;政府机关;乡镇以下级政府及事业单位"
                },
                {
                    "id": "B0172019RY",
                    "direction": "东南",
                    "businessarea": "团结路商业街",
                    "address": "中国农业银行(货场路北)",
                    "poiweight": "0.141845",
                    "name": "商丘市梁园区植保植检站",
                    "location": "115.639209,34.443836",
                    "distance": "239.326",
                    "tel": [],
                    "type": "政府机构及社会团体;政府机关;区县级政府及事业单位"
                },
                {
                    "id": "B0FFHS5T5K",
                    "direction": "东南",
                    "businessarea": "团结路商业街",
                    "address": "气象局西侧50米",
                    "poiweight": "0.162519",
                    "name": "建材家具商场(金建小区店)",
                    "location": "115.638525,34.443625",
                    "distance": "231.704",
                    "tel": "15836822735;15896992219",
                    "type": "购物服务;家居建材市场;家具城"
                },
                {
                    "id": "B0FFK5DV08",
                    "direction": "南",
                    "businessarea": "团结路商业街",
                    "address": "货场东路社区居委会东南侧60米",
                    "poiweight": "0.184035",
                    "name": "舒雅实木家具(货场路店)",
                    "location": "115.638197,34.443362",
                    "distance": "252.517",
                    "tel": "18595435634",
                    "type": "购物服务;家居建材市场;家居建材市场"
                },
                {
                    "id": "B017201A8X",
                    "direction": "东南",
                    "businessarea": "团结路商业街",
                    "address": "货场路北50米",
                    "poiweight": "0.100328",
                    "name": "梁园区农村劳动力转移培训办公室",
                    "location": "115.639209,34.443836",
                    "distance": "239.326",
                    "tel": [],
                    "type": "政府机构及社会团体;政府机关;区县级政府及事业单位"
                },
                {
                    "id": "B0FFFE93QP",
                    "direction": "东南",
                    "businessarea": "团结路商业街",
                    "address": "长征街道货场路水利局(中国农业银行旁)",
                    "poiweight": "0.10798",
                    "name": "商丘市梁园区河道管理站",
                    "location": "115.639621,34.444106",
                    "distance": "241.369",
                    "tel": [],
                    "type": "政府机构及社会团体;政府机关;区县级政府及事业单位"
                },
                {
                    "id": "B0FFFFYVHL",
                    "direction": "西",
                    "businessarea": "团结路商业街",
                    "address": "长征路储运小区",
                    "poiweight": "0.182562",
                    "name": "123双语回族幼儿园",
                    "location": "115.635075,34.445775",
                    "distance": "242.245",
                    "tel": "13781633328;15090676665",
                    "type": "科教文化服务;学校;幼儿园"
                },
                {
                    "id": "B0FFFFYGVC",
                    "direction": "西北",
                    "businessarea": "团结路商业街",
                    "address": "货场路冷冻厂门口",
                    "poiweight": "0.231192",
                    "name": "鑫源雅居",
                    "location": "115.634753,34.447177",
                    "distance": "322.948",
                    "tel": [],
                    "type": "商务住宅;住宅区;住宅小区"
                },
                {
                    "id": "B0FFGJSUUX",
                    "direction": "南",
                    "businessarea": "团结路商业街",
                    "address": "长征路与货场路交叉口东500米路南宜美家家具",
                    "poiweight": "0.178008",
                    "name": "正昌家具",
                    "location": "115.637366,34.443223",
                    "distance": "265.799",
                    "tel": "13193409688;18736795967",
                    "type": "购物服务;家居建材市场;家具城"
                },
                {
                    "id": "B0FFFFYJ7Z",
                    "direction": "西南",
                    "businessarea": "团结路商业街",
                    "address": "物华新苑南门旁",
                    "poiweight": "0.210808",
                    "name": "永盛家具城(物华新苑店)",
                    "location": "115.636178,34.443491",
                    "distance": "272.946",
                    "tel": "13937046623;13937069989",
                    "type": "购物服务;家居建材市场;家具城"
                },
                {
                    "id": "B0FFHMF7OG",
                    "direction": "西南",
                    "businessarea": "团结路商业街",
                    "address": "物华新苑南门旁",
                    "poiweight": "0.178552",
                    "name": "国权床具批发(物华新苑店)",
                    "location": "115.636110,34.443487",
                    "distance": "276.598",
                    "tel": "18637016284",
                    "type": "购物服务;家居建材市场;家具城"
                },
                {
                    "id": "B0FFLGZRFE",
                    "direction": "东南",
                    "businessarea": "团结路商业街",
                    "address": "金建小区北门东北60米",
                    "poiweight": "0.164026",
                    "name": "梦阳棕垫地板革地毯",
                    "location": "115.639830,34.443686",
                    "distance": "288.118",
                    "tel": "13849641314",
                    "type": "购物服务;家居建材市场;家居建材市场"
                },
                {
                    "id": "B0FFHNHGV7",
                    "direction": "西南",
                    "businessarea": "团结路商业街",
                    "address": "货场路与长征路交叉口东180米",
                    "poiweight": "0.186376",
                    "name": "长征餐桌批发",
                    "location": "115.636175,34.443525",
                    "distance": "269.866",
                    "tel": "15138562218;17703800288",
                    "type": "购物服务;家居建材市场;家具城"
                },
                {
                    "id": "B0FFG1UXHJ",
                    "direction": "西南",
                    "businessarea": "团结路商业街",
                    "address": "物华新苑南门旁",
                    "poiweight": "0.177697",
                    "name": "张庄木业精品床具",
                    "location": "115.636046,34.443483",
                    "distance": "280.108",
                    "tel": "15090696633;15539037788",
                    "type": "购物服务;家居建材市场;家居建材市场"
                },
                {
                    "id": "B0FFHP3WNF",
                    "direction": "东南",
                    "businessarea": "团结路商业街",
                    "address": "金建小区北门西70米",
                    "poiweight": "0.17588",
                    "name": "亿轩床业",
                    "location": "115.638905,34.443341",
                    "distance": "273.794",
                    "tel": [],
                    "type": "购物服务;家居建材市场;家具城"
                }
            ]
        },
        "info": "OK",
        "infocode": "10000"
    }
}
```


---

## ✅ 接口文档说明总结

1. **统一返回格式**

```json
{
  "code": int,
  "message": string,
  "data": object|array
}
```

2. **优惠逻辑统一处理**

* 商户优惠 → 优先加载
* 平台优惠 → 后加载
* 节假日优惠 → 自动通过 `promotion_scene` + `holiday_calendar` 判断

3. **房型价格计算流程**

```
基础价格 → 商户优惠 → 平台优惠 → 最终显示价格
```

4. **分页查询**

* 列表接口支持 `page` + `size` 参数
* 返回结果包含总数 `total`（可选）

5. **日期相关接口**

* `check_in` / `check_out` 全部用 `yyyy-MM-dd` 格式
* 节假日判断统一由 `holiday_calendar` 提供

---
