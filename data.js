window.KNOWLEDGE_CATEGORIES = [
  "学习路线与工具",
  "Java 与数据交互",
  "Spring Boot 开发",
  "认证与安全",
  "数据库与高并发",
  "Linux 与部署",
];

window.KNOWLEDGE = [
  {
    id: "interceptor-threadlocal",
    category: "Spring Boot 开发",
    order: 30,
    title: "请求拦截与用户上下文",
    summary: "用 Interceptor 和 ThreadLocal 管理当前登录用户",
    related: ["sso-single-sign-on"],
    content: `
      <span class="article-tag">Spring Boot 开发</span>
      <h1>请求拦截与用户上下文</h1>
      <p class="lead">这两个经常一起用，但不是一回事。<strong>拦截器</strong>负责「在请求进 Controller 前后做统一处理」；<strong>ThreadLocal</strong>负责「在当前线程里临时保存数据」。</p>

      <h2>典型组合：登录用户上下文</h2>
      <pre class="flow">请求进来
  ↓
Interceptor 解析 Token
  ↓
查到当前用户
  ↓
ThreadLocal.set(user)
  ↓
Controller / Service
  ↓
ThreadLocal.get()
  ↓
请求结束
  ↓
ThreadLocal.remove()</pre>

      <h3>UserContext 示例</h3>
      <pre><code>public class UserContext {

    private static final ThreadLocal&lt;User&gt; LOCAL = new ThreadLocal&lt;&gt;();

    public static void set(User user) {
        LOCAL.set(user);
    }

    public static User get() {
        return LOCAL.get();
    }

    public static void remove() {
        LOCAL.remove();
    }
}</code></pre>

      <h3>拦截器里放入 / 清掉</h3>
      <pre><code>@Override
public boolean preHandle(...) {
    User user = parseToken(request);
    UserContext.set(user);
    return true;
}

@Override
public void afterCompletion(...) {
    UserContext.remove();
}</code></pre>

      <h3>Service 里直接取</h3>
      <pre><code>User user = UserContext.get();</code></pre>
      <p>不用每层都传：</p>
      <pre><code>service.xxx(userId);
service2.xxx(userId);
service3.xxx(userId);</code></pre>

      <h2>底层理解</h2>
      <p><code>ThreadLocal</code> 不是「全局变量」。它的核心是：</p>
      <pre class="flow">每一个线程
都有自己独立的一份变量副本</pre>
      <pre class="flow">线程1 → User A
线程2 → User B
线程3 → User C</pre>
      <p>互相不会直接拿到对方的数据。</p>
      <p>Web 请求通常由 Tomcat 线程处理，所以：</p>
      <pre class="flow">一个请求 ≈ 一个工作线程</pre>
      <p>于是可以把当前用户绑定到这个线程。</p>

      <h2>为什么必须 remove</h2>
      <p>Tomcat 使用的是<strong>线程池</strong>。请求结束后线程不会销毁：</p>
      <pre class="flow">请求A
 ↓
线程1
 ↓
保存 User A
 ↓
请求结束

线程1不会死
 ↓
以后继续处理请求B</pre>
      <p>如果不调用 <code>ThreadLocal.remove()</code>，就可能导致：</p>
      <ul>
        <li>用户数据残留</li>
        <li>请求串数据</li>
        <li>内存泄漏风险</li>
      </ul>
      <p>所以这是非常重要的开发规范。</p>

      <h2>一个容易踩的坑</h2>
      <p>ThreadLocal 只跟<strong>线程</strong>绑定。如果这样写：</p>
      <pre><code>@Async
public void test() {
    UserContext.get();
}</code></pre>
      <p>新线程里通常拿不到原线程的 ThreadLocal。涉及异步任务、CompletableFuture、线程池时，不能想当然认为 ThreadLocal 会自动传递。</p>

      <h2>项目业务理解</h2>
      <p>比如设备操作 <code>POST /device/open</code>：</p>
      <pre class="flow">解析 JWT
→ 得到 userId
→ ThreadLocal 保存当前用户</pre>
      <pre><code>User user = UserContext.get();

operationLogService.save(
    user.getId(),
    "打开设备"
);</code></pre>
      <p>这样业务层就知道：「是谁执行了这次操作」。</p>

      <h2>面试可以这么说</h2>
      <blockquote>
        <p>拦截器负责在请求进入 Controller 前做统一处理，例如解析 Token；ThreadLocal 用于保存当前请求线程的用户上下文，使 Controller、Service 等层可以直接获取当前用户。由于 Web 容器使用线程池，请求结束后必须调用 remove，避免数据残留和内存泄漏。同时 ThreadLocal 数据默认不会跨线程传递。</p>
      </blockquote>

      <p>两者关系可以直接记成：</p>
      <blockquote>
        <p><strong>Interceptor 负责「放进去」，ThreadLocal 负责「存起来」，业务代码负责「取出来」，请求结束负责「清掉」。</strong></p>
      </blockquote>

      <section class="dig">
        <div class="dig-head">
          <span class="dig-label">深挖</span>
          <p class="dig-ask"><strong>疑问方向：</strong>流程图里的「Interceptor 解析 Token」具体是怎么做的？Token 从哪来、怎么校验、怎么变成当前用户？</p>
        </div>
        <h2>Interceptor 解析 Token</h2>
        <p>可以理解成：请求到了后端以后，拦截器先把请求头里的 Token 拿出来，判断这个 Token 是谁的、是否合法。</p>

        <p>前端请求例如：</p>
        <pre><code>GET /api/device/list
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...</code></pre>

        <p>拦截器先取请求头：</p>
        <pre><code>String token = request.getHeader("Authorization");</code></pre>
        <p>然后通常会去掉前缀 <code>Bearer </code>，得到真正的 JWT，再解析：</p>
        <pre><code>Long userId = jwtUtil.getUserId(token);</code></pre>

        <p>所谓「解析 Token」，本质上就是：</p>
        <pre class="flow">Token
 ↓
校验签名
 ↓
判断是否过期
 ↓
读取里面的数据
 ↓
得到 userId / username / role 等</pre>

        <p>JWT 里可能保存：</p>
        <pre><code>{
  "userId": 1001,
  "username": "zhangsan",
  "role": "admin",
  "exp": 1790000000
}</code></pre>

        <p>解析后得到 <code>userId = 1001L</code>，再查用户或 Redis 登录状态，最后：</p>
        <pre><code>User user = userService.getById(userId);
UserContext.set(user);</code></pre>

        <p>完整链路：</p>
        <pre class="flow">前端携带 Token
    ↓
Interceptor 获取 Token
    ↓
校验 Token
    ↓
解析出 userId
    ↓
查用户 / Redis
    ↓
ThreadLocal 保存用户
    ↓
Controller</pre>

        <p><strong>「解析 Token」不等于「Token 一定合法」。</strong>通常还要检查：Token 是否存在、格式是否正确、签名是否正确、是否过期、用户是否还存在、登录状态是否已失效。</p>

        <blockquote>
          <p>拦截器解析 Token，就是在请求进入 Controller 前，从请求头中取出 JWT，校验签名和过期时间，提取用户身份信息，再放入用户上下文供后续业务使用。</p>
        </blockquote>
      </section>
    `,
  },
  {
    id: "sso-single-sign-on",
    category: "认证与安全",
    order: 10,
    title: "单点登录（SSO）",
    summary: "统一认证中心如何让多个系统共享登录状态",
    related: ["interceptor-threadlocal"],
    content: `
      <span class="article-tag">认证与安全</span>
      <h1>单点登录（SSO）</h1>
      <p class="lead"><strong>单点登录 = SSO（Single Sign-On）</strong>。先记一句：</p>
      <blockquote>
        <p><strong>用户只登录一次，就可以访问多个相互独立的系统。</strong></p>
      </blockquote>

      <p>比如公司里有：</p>
      <pre class="flow">OA系统
财务系统
实验室系统
人事系统</pre>

      <p>如果没有 SSO：</p>
      <pre class="flow">OA 登录一次
财务再登录一次
实验室再登录一次</pre>

      <p>有了 SSO：</p>
      <pre class="flow">登录中心登录一次
   ↓
OA 能访问
财务能访问
实验室也能访问</pre>

      <h2>底层理解</h2>
      <p>核心不是「多个系统共用一个账号」这么简单，而是：</p>
      <blockquote>
        <p><strong>多个系统都信任同一个认证中心。</strong></p>
      </blockquote>

      <p>大概流程：</p>
      <pre class="flow">用户访问 系统A
   ↓
发现没登录
   ↓
跳转到统一登录中心
   ↓
用户登录
   ↓
登录中心生成票据 / Token
   ↓
系统A验证成功
   ↓
以后访问系统B
   ↓
系统B也去信任这个登录中心
   ↓
无需再次输入密码</pre>

      <p>所以 SSO 通常包含两个角色：</p>
      <pre class="flow">认证中心
业务系统</pre>

      <p>认证中心负责：</p>
      <pre class="flow">登录
身份验证
发 Token
维护登录状态</pre>

      <p>业务系统负责：</p>
      <pre class="flow">验证 Token
识别用户身份</pre>

      <h2>和 JWT 的关系</h2>
      <p><code>SSO</code> 是一种<strong>登录架构 / 方案</strong>。<code>JWT</code> 是一种<strong>Token 格式</strong>。</p>
      <pre class="flow">SSO ≠ JWT</pre>
      <p>但可以：</p>
      <pre class="flow">SSO + JWT</pre>
      <p>例如统一认证中心登录后发 JWT，各业务系统都验证这个 JWT。</p>

      <h2>项目里怎么理解</h2>
      <p>假设以后 ALMS 实验室系统要接学校统一身份认证。学生已经登录学校门户：</p>
      <pre class="flow">学校统一认证中心</pre>
      <p>再打开：</p>
      <pre class="flow">ALMS</pre>
      <p>不需要再输入用户名密码，这就是典型 SSO。</p>

      <h2>常见实现</h2>
      <p>开发里经常看到：</p>
      <pre class="flow">CAS
OAuth 2.0
OpenID Connect
SAML</pre>
      <p>其中现代 Web 系统比较常见的是：</p>
      <pre class="flow">OAuth 2.0 + OpenID Connect</pre>
      <p>注意：<strong>OAuth 2.0 本身主要解决授权，不等同于登录协议</strong>；真正用于身份认证时通常会结合 OIDC。</p>

      <h2>开发注意</h2>
      <ul>
        <li>Token 过期</li>
        <li>多系统之间如何信任</li>
        <li>退出登录是否要「全部系统一起退出」</li>
        <li>Token 泄漏</li>
        <li>跨域问题</li>
        <li>重定向地址安全</li>
        <li>认证中心挂了会影响多个系统</li>
      </ul>

      <h2>面试回答</h2>
      <blockquote>
        <p>SSO 是 Single Sign-On，单点登录。核心思想是多个业务系统统一信任一个认证中心，用户只需在认证中心登录一次，后续访问其他受信任系统时，通过票据或 Token 完成身份验证，而不需要重复输入账号密码。</p>
      </blockquote>

      <p>再记一个区别：</p>
      <pre class="flow">普通登录：
每个系统自己登录

SSO：
统一认证中心登录一次
多个系统共享认证结果</pre>
    `,
  },
  {
    id: "java-object-json-serialize",
    category: "Java 与数据交互",
    order: 20,
    title: "Java 对象、JSON 与序列化",
    summary: "理解对象与 JSON 的双向转换及请求链路",
    related: ["java-object-create-dto"],
    content: `
      <span class="article-tag">Java 与数据交互</span>
      <h1>Java 对象、JSON 与序列化</h1>
      <p class="lead">这几个概念要连着理解，尤其在 Java 后端里，和 JSON 关系非常大。</p>

      <h2>1. Java 对象</h2>
      <p>比如有一个 Java 类：</p>
      <pre><code>public class User {
    private Long id;
    private String name;
}</code></pre>
      <p>创建对象：</p>
      <pre><code>User user = new User();
user.setId(1L);
user.setName("张三");</code></pre>
      <p>此时 <code>user</code> 是一个 <strong>Java 对象</strong>，存在 JVM 内存中：</p>
      <pre class="flow">Java对象
User {
    id = 1
    name = "张三"
}</pre>

      <section class="dig">
        <div class="dig-head">
          <span class="dig-label">深挖</span>
          <p class="dig-ask"><strong>疑问方向：</strong><code>user.setId(1L)</code> 到底是在干什么？这里的 <code>setId</code>、<code>id</code>、<code>1L</code> 分别是什么？</p>
        </div>
        <h3>setId 是方法，不是属性</h3>
        <p><code>setId(1L)</code> 是一个<strong>方法调用</strong>，不是属性。例如：</p>
        <pre><code>public class User {

    private Long id;

    public void setId(Long id) {
        this.id = id;
    }
}</code></pre>
        <ul>
          <li><code>id</code> 是属性，也叫字段（field）</li>
          <li><code>setId()</code> 是方法（method）</li>
          <li><code>1L</code> 是传进去的参数，表示 <code>long</code> 类型的数字 1</li>
          <li><code>this.id = id</code> 才是真正给对象里的 <code>id</code> 属性赋值</li>
        </ul>
        <pre class="flow">id       → 属性/字段
setId()  → 方法
1L       → 参数值</pre>
        <pre><code>user.getId();   // getter（获取方法）
user.setId(1L); // setter（设置方法）</code></pre>
        <p>以后看到 Java Bean、DTO、实体类时，会大量见到 <code>getXxx()</code> 和 <code>setXxx()</code>。</p>
      </section>

      <section class="dig">
        <div class="dig-head">
          <span class="dig-label">深挖</span>
          <p class="dig-ask"><strong>疑问方向：</strong><code>private Long id;</code> 算不算实例化？声明属性、创建对象、赋值是一回事吗？</p>
        </div>
        <h3>声明属性 ≠ 实例化</h3>
        <p><code>private Long id;</code> <strong>不叫实例化</strong>。它只是在类中声明了一个成员变量 / 属性 / 字段。类相当于模板，真正实例化是：</p>
        <pre><code>User user = new User();</code></pre>
        <pre class="flow">class User
    ↓
类 / 模板

private Long id;
    ↓
定义这个类有哪些属性

new User()
    ↓
实例化 / 创建对象

user.setId(1L)
    ↓
给对象属性赋值</pre>
        <p><code>Long</code> 是引用类型，刚 <code>new</code> 出来时 <code>user.getId()</code> 默认是 <code>null</code>。</p>
        <blockquote>
          <p><strong>声明属性 ≠ 创建对象 ≠ 给属性赋值</strong>，这是三个不同动作。</p>
        </blockquote>
      </section>

      <h2>2. 序列化 Serialization</h2>
      <p><strong>序列化 = 把对象转换成一种可以传输或保存的数据格式。</strong></p>
      <pre class="flow">Java对象
   ↓ 序列化
JSON字符串</pre>
      <pre><code>{
  "id": 1,
  "name": "张三"
}</code></pre>
      <p>Java 后端最常见：</p>
      <pre><code>ObjectMapper mapper = new ObjectMapper();

String json = mapper.writeValueAsString(user);</code></pre>
      <p>得到的是字符串：</p>
      <pre><code>"{\\"id\\":1,\\"name\\":\\"张三\\"}"</code></pre>
      <p>本质上是一个 <code>String</code>。</p>

      <h2>3. 反序列化 Deserialization</h2>
      <pre class="flow">JSON
 ↓ 反序列化
Java对象</pre>
      <pre><code>User user = mapper.readValue(json, User.class);
user.getName(); // 张三</code></pre>

      <h2>4. 和后端请求的关系</h2>
      <p>前端发送：</p>
      <pre><code>{
  "username": "admin",
  "password": "123456"
}</code></pre>
      <pre><code>@PostMapping("/login")
public void login(@RequestBody LoginDTO dto) {

}</code></pre>
      <p>Spring 会自动做：</p>
      <pre class="flow">HTTP请求里的JSON
       ↓
反序列化
       ↓
LoginDTO对象</pre>
      <p><code>@RequestBody</code> 背后其实涉及 <strong>JSON 反序列化</strong>。</p>
      <p>返回数据时：</p>
      <pre><code>@GetMapping("/user")
public User getUser() {
    return user;
}</code></pre>
      <pre class="flow">User对象
   ↓
序列化
   ↓
JSON
   ↓
返回给前端</pre>
      <p>整条前后端链路：</p>
      <pre class="flow">前端
JSON
 ↓
HTTP
 ↓
Spring
 ↓
反序列化
 ↓
Java对象
 ↓
Controller / Service
 ↓
Java对象
 ↓
序列化
 ↓
JSON
 ↓
前端</pre>

      <h2>5. 谁负责 JSON 转换？</h2>
      <p>Spring Boot 默认常见的是 <strong>Jackson</strong>，核心类是 <code>ObjectMapper</code>：</p>
      <ul>
        <li><code>writeValueAsString()</code>：对象 → JSON</li>
        <li><code>readValue()</code>：JSON → 对象</li>
      </ul>
      <p>Spring MVC 底层还会通过 <code>HttpMessageConverter</code> 完成请求体和 Java 对象之间的转换。</p>

      <h2>6. 容易混淆：Serializable</h2>
      <p>Java 还有 <code>implements Serializable</code>，和 JSON 序列化不是完全一回事。</p>
      <pre class="flow">Java 原生序列化：
Java对象 → 二进制数据

JSON 序列化：
Java对象 → JSON文本</pre>
      <p>Web 开发里说「把对象序列化成 JSON」，通常指 Jackson / Gson，而不是 Java 原生 <code>Serializable</code>。</p>

      <h2>面试怎么答</h2>
      <blockquote>
        <p>序列化是把 Java 对象转换成可以存储或传输的数据格式，例如 JSON；反序列化是把 JSON 等数据重新转换成 Java 对象。Spring MVC 中，<code>@RequestBody</code> 接收 JSON 时会进行反序列化，而 Controller 返回 Java 对象时会通过 Jackson 等组件序列化成 JSON。</p>
      </blockquote>
      <pre class="flow">new User()
    ↓
Java对象

Java对象 → JSON
    序列化

JSON → Java对象
    反序列化</pre>
      <p>这是以后理解 Controller、DTO、Redis、MQ、RPC 的基础。</p>
    `,
  },
  {
    id: "java-object-create-dto",
    category: "Java 与数据交互",
    order: 10,
    title: "对象创建、DTO 与参数映射",
    summary: "从 new 对象到按 JSON 建模和 Controller 接参",
    related: ["java-object-json-serialize"],
    content: `
      <span class="article-tag">Java 与数据交互</span>
      <h1>对象创建、DTO 与参数映射</h1>
      <p class="lead">对象的创建，核心就是这句：</p>
      <pre><code>User user = new User();</code></pre>
      <p>拆成三部分理解：</p>
      <pre class="flow">User      → 类型
user      → 引用变量
new User() → 真正创建对象</pre>
      <p>真正发生「实例化」的是 <code>new User()</code>，它会在 JVM 内存中创建一个 <code>User</code> 对象。</p>

      <pre><code>public class User {
    private Long id;
    private String name;
}

User user = new User();</code></pre>
      <p>刚创建出来时大致是：</p>
      <pre class="flow">User对象
id   = null
name = null</pre>
      <p>再执行赋值后变成：</p>
      <pre><code>user.setId(1L);
user.setName("张三");</code></pre>
      <pre class="flow">User对象
id   = 1
name = "张三"</pre>

      <h2>底层理解</h2>
      <pre class="flow">new User()
   ↓
JVM在堆内存中开辟空间
   ↓
初始化成员变量
   ↓
执行构造方法
   ↓
返回对象引用
   ↓
赋值给 user</pre>
      <p>所以更准确地说：</p>
      <blockquote>
        <p><code>user</code> 是一个引用变量，它指向堆内存中的 <code>User</code> 对象。</p>
      </blockquote>
      <pre class="flow">user
 │
 │ 引用
 ↓
┌─────────────┐
│ User对象     │
│ id = null   │
│ name = null │
└─────────────┘</pre>

      <h2>构造方法</h2>
      <pre><code>public class User {

    public User() {
        System.out.println("User对象被创建了");
    }
}

User user = new User(); // 打印：User对象被创建了</code></pre>
      <blockquote>
        <p><strong>类是模板，<code>new</code> 是创建对象，创建出来的对象叫这个类的实例。</strong></p>
      </blockquote>
      <p>面试若继续深挖「对象怎么创建」，后面可接到 JVM：</p>
      <pre class="flow">类加载
→ 检查类是否加载
→ 堆内存分配
→ 默认初始化
→ 显式初始化
→ 构造方法
→ 返回对象引用</pre>

      <section class="dig">
        <div class="dig-head">
          <span class="dig-label">深挖</span>
          <p class="dig-ask"><strong>疑问方向：</strong>截图里 DTO 类和 JSON 字段一一对应，这是不是创建对象？实际项目里对象通常怎么来的？<code>@Data</code> 又是干什么的？</p>
        </div>
        <h2>截图：按 JSON 写 DTO，不等于 new 出对象</h2>
        <figure>
          <img src="assets/dto-json-mapping.png" alt="TotalDto 与 JSON 字段对照" />
          <figcaption>左侧 TotalDto 字段与右侧 JSON key 对应；template 是嵌套对象，对应 TemplateDto。</figcaption>
        </figure>

        <p>先区分两个动作。下面这一步<strong>不是创建对象</strong>，而是<strong>定义 DTO 类，描述这个对象应该有哪些字段</strong>：</p>
        <pre><code>public class TotalDto {
    private String user;
    private Integer enableIdTrans;
    private Integer duplicateCheckInterval;
    private TemplateDto template;
}</code></pre>

        <p>真正创建对象是：</p>
        <pre><code>TotalDto dto = new TotalDto();
dto.setUser("UserID1|UserID2");
dto.setEnableIdTrans(0);
dto.setDuplicateCheckInterval(1800);

TemplateDto template = new TemplateDto();
template.setCardType("text_notice");
dto.setTemplate(template);</code></pre>

        <p>真实开发里更常见的是：<strong>不用手动 new，Spring 根据 JSON 自动创建对象</strong>。</p>
        <pre><code>@PostMapping("/send")
public void send(@RequestBody TotalDto dto) {
    System.out.println(dto.getUser());
}</code></pre>
        <pre class="flow">JSON
 ↓
Jackson 反序列化
 ↓
new TotalDto()
 ↓
给字段赋值
 ↓
得到 TotalDto 对象</pre>

        <p>截图中的 <code>@Data</code> 是 Lombok 注解，主要帮你自动生成 getter / setter / toString / equals / hashCode，<strong>它本身不是用来创建对象的</strong>。</p>
        <pre class="flow">DTO 类
↓
定义数据长什么样

new DTO()
↓
手动创建对象

@RequestBody DTO
↓
Spring 根据 JSON 自动创建对象</pre>
      </section>

      <section class="dig">
        <div class="dig-head">
          <span class="dig-label">深挖</span>
          <p class="dig-ask"><strong>疑问方向：</strong>为什么要这样设计 Java 对象？为什么 <code>template</code> 要单独一个类？DTO 和数据库 Entity 有什么区别？合格后端看到数据结构时在想什么？</p>
        </div>
        <h2>从「会 new」到「会建模」</h2>
        <p>真正的后端能力，不是只会写 <code>new User()</code>，而是看到业务数据后，知道<strong>为什么这样设计对象，以及它在系统里扮演什么角色</strong>。</p>
        <p>拿到截图里的 JSON，先在脑子里拆：</p>
        <pre class="flow">这是「一次请求」的完整数据
         ↓
最外层是一个对象
         ↓
里面有 user、开关、时间等字段
         ↓
template 本身又是一组完整的数据
         ↓
所以 template 应该再抽成一个对象</pre>
        <pre><code>public class TotalDto {
    private String user;
    private Integer enableIdTrans;
    private Integer duplicateCheckInterval;
    private TemplateDto template;
}

public class TemplateDto {
    private String cardType;
}</code></pre>
        <blockquote>
          <p><strong>把业务中的数据结构，建模成 Java 对象。</strong>这叫数据建模 / 对象建模。</p>
        </blockquote>

        <h3>拿到接口先想什么</h3>
        <p>例如「实验室设备预约」：先定数据，再写 Controller。</p>
        <pre><code>{
  "deviceId": 1001,
  "startTime": "2026-09-30 09:00",
  "endTime": "2026-09-30 11:00"
}</code></pre>
        <pre><code>public class DeviceReserveRequest {
    private Long deviceId;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
}</code></pre>
        <pre class="flow">业务需求
 ↓
确定需要什么数据
 ↓
设计数据结构
 ↓
Java类建模
 ↓
Controller接收
 ↓
Service处理业务
 ↓
数据库保存/查询
 ↓
返回结果</pre>

        <h3>为什么 template 要单独一个类？</h3>
        <p>可以硬写成一堆平铺字段，但很差。因为业务上 <code>template</code> 本身就是一个完整概念，所以：</p>
        <blockquote>
          <p><strong>业务上属于同一个概念的数据，应该组织成一个对象。</strong></p>
        </blockquote>
        <p>这才是面向对象真正落地的地方，而不只是背「封装、继承、多态」。</p>

        <h3>再进一步：字段设计合不合理</h3>
        <p>看到 <code>private String user;</code> 对应 <code>"UserID1|UserID2|UserID3"</code>，应马上问：这真的是一个字符串吗？实际表达的是多个用户，更合理可能是：</p>
        <pre><code>private List&lt;String&gt; users;</code></pre>
        <p>因为字符串要用 <code>split("|")</code>，而 <code>List</code> 本身就表示多个。这是从「照着 JSON 写类」进阶到「判断 JSON 设计是否合理」。</p>

        <h3>DTO 是什么</h3>
        <p><code>DTO = Data Transfer Object</code>，数据传输对象：专门负责在系统之间传递数据。</p>
        <pre class="flow">DTO  → 负责接口数据
Entity → 负责数据库数据</pre>
        <p>数据库 User 可能有很多字段，登录接口却只需要 username / password，所以不要把 Entity 直接当接口入参。</p>

        <h3>写接口时养成这几个问题</h3>
        <ol>
          <li>这个接口到底解决什么业务问题？</li>
          <li>前端需要传哪些数据？每个字段是什么类型？</li>
          <li>哪些字段属于一个完整业务对象，需要再拆一个类？</li>
          <li>这是 DTO、数据库 Entity，还是返回给前端的 VO？</li>
          <li>哪些要校验，哪些逻辑应放 Service，而不是 Controller？</li>
        </ol>
        <p>例如 <code>duplicateCheckInterval</code>：能不能为 null？能不能传负数？单位是秒还是毫秒？最大值多少？0 代表什么？</p>

        <blockquote>
          <p>初级看到 <code>private TemplateDto template;</code> 想的是「这里放了个对象」；合格后端会想：这是独立业务结构所以抽类，反序列化时 Jackson 会创建它，它是接口传输模型不一定对应库表，进 Service 后还要校验和业务处理。</p>
        </blockquote>
        <p>后续很值得继续弄清：<strong>DTO、VO、Entity、POJO 分别是什么，为什么项目里会有那么多「对象类」</strong>。</p>
      </section>

      <section class="dig">
        <div class="dig-head">
          <span class="dig-label">深挖</span>
          <p class="dig-ask"><strong>疑问方向：</strong>这段 Controller 代码每一部分是什么意思？注解、参数、对象、Controller 和 Service 怎么配合？</p>
        </div>
        <h2>拆开看 Controller</h2>
        <pre><code>@PostMapping("/device/reserve")
public void reserve(
        @RequestBody DeviceReserveRequest request) {

    reserveService.reserve(request);
}</code></pre>
        <p>一句话：前端调用 <code>/device/reserve</code> 并传 JSON；Spring 把 JSON 转成 <code>DeviceReserveRequest</code>，再交给 Service 处理预约。</p>

        <ul>
          <li><code>@PostMapping("/device/reserve")</code>：处理 <code>POST /device/reserve</code></li>
          <li><code>public void reserve(...)</code>：公开方法；void 表示这里不直接返回数据；reserve 是方法名</li>
          <li><code>@RequestBody</code>：从 HTTP 请求体读取 JSON</li>
          <li><code>DeviceReserveRequest request</code>：反序列化后的 Java 对象</li>
          <li><code>reserveService.reserve(request)</code>：Controller 不写复杂逻辑，交给 Service</li>
        </ul>

        <pre class="flow">前端
 ↓
POST /device/reserve
 ↓
Controller
 ↓
@RequestBody
 ↓
JSON 转 Java 对象
 ↓
DeviceReserveRequest request
 ↓
reserveService.reserve(request)
 ↓
Service处理业务
 ↓
数据库</pre>

        <pre class="flow">Controller → 接请求、拿参数、调用业务层
Service    → 真正的业务逻辑</pre>
        <blockquote>
          <p><code>@PostMapping</code> 用来映射 POST 请求，<code>@RequestBody</code> 将请求体中的 JSON 反序列化成 Java 对象，Controller 接收参数后调用 Service 完成具体业务逻辑。</p>
        </blockquote>
        <p>容易卡住的基础通常是：注解、方法、参数、对象、Controller、Service。这些弄清后，Spring Boot 代码会好看很多。</p>
      </section>
    `,
  },
  {
    id: "springboot-fullstack-roadmap",
    category: "学习路线与工具",
    order: 20,
    title: "Spring Boot 全栈项目：从 0 到 1",
    summary: "用 Vue、Spring Boot 和 MySQL 串起完整请求链路",
    related: [
      "learning-path-crud-first",
      "java-object-create-dto",
      "java-object-json-serialize",
      "interceptor-threadlocal",
      "linux-common-commands",
      "springboot-user-admin-crud",
    ],
    content: `
      <span class="article-tag">学习路线与工具</span>
      <h1>Spring Boot 全栈项目：从 0 到 1</h1>
      <p class="lead">现在最适合的不是继续零散背知识点，而是<strong>亲手从 0 做一个完整 Spring Boot 前后端项目</strong>，过程中遇到什么再把底层知识补进去。</p>

      <h2>技术组合</h2>
      <pre class="flow">前端：Vue 3
后端：Spring Boot
数据库：MySQL
持久层：MyBatis
接口：RESTful API
数据格式：JSON
构建工具：Maven</pre>

      <h2>先把整个系统看懂</h2>
      <pre class="flow">浏览器
  ↓
Vue 前端
  ↓ HTTP请求 + JSON
Controller
  ↓
Service
  ↓
Mapper
  ↓
MySQL

数据库查询结果
  ↓
Java对象
  ↓
JSON
  ↓
Vue
  ↓
页面显示</pre>
      <p>这张图以后会贯穿整个 Java 后端开发。</p>

      <h2>做什么项目</h2>
      <p>直接做一个小型的<strong>实验室设备预约系统</strong>。第一版只做：</p>
      <pre class="flow">用户登录
用户列表
设备列表
新增设备
修改设备
删除设备
预约设备
查看预约记录</pre>
      <p>这已经能覆盖 Java 后端最重要的基础。</p>

      <h2>第一阶段：创建 Spring Boot 项目</h2>
      <p>基础目录大概长这样：</p>
      <pre class="flow">src/main/java
└── com.example.demo
    ├── controller
    │      DeviceController.java
    ├── service
    │      DeviceService.java
    ├── mapper
    │      DeviceMapper.java
    ├── entity
    │      Device.java
    ├── dto
    │      DeviceCreateRequest.java
    └── DemoApplication.java</pre>
      <pre class="flow">Controller → 接收前端请求
Service    → 处理业务
Mapper     → 操作数据库
Entity     → 数据库对象
DTO        → 接口传输对象</pre>
      <p>这五个东西是以后每天都会写的。</p>

      <h2>第二阶段：先做数据库</h2>
      <pre><code>CREATE TABLE device (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    status INT
);</code></pre>
      <pre class="flow">id    name        status
1     摄像头01      1
2     振动台01      1
3     空调01        0</pre>
      <pre><code>public class Device {
    private Long id;
    private String name;
    private Integer status;
}</code></pre>
      <p>这里串起前面学过的：</p>
      <pre class="flow">private Long id;     → 定义对象的属性
Device device = new Device(); → 创建 Device 对象</pre>

      <h2>第三阶段：Mapper 操作数据库</h2>
      <pre><code>@Mapper
public interface DeviceMapper {

    @Select("select * from device")
    List&lt;Device&gt; findAll();
}</code></pre>
      <pre class="flow">Mapper
   ↓
执行 SQL
   ↓
MySQL

数据库数据
   ↓
Java对象（List&lt;Device&gt;）</pre>

      <h2>第四阶段：Service 写业务</h2>
      <pre><code>@Service
public class DeviceService {

    @Autowired
    private DeviceMapper deviceMapper;

    public List&lt;Device&gt; list() {
        return deviceMapper.findAll();
    }
}</code></pre>
      <p>多这一层不是为了「多写」，而是分层：</p>
      <pre class="flow">Controller → 负责接口
Service    → 负责业务
Mapper     → 负责数据库</pre>
      <p>以后预约设备这类判断（设备是否存在、是否已被预约、权限、写预约记录）都应放在 Service，而不是 Controller。</p>

      <h2>第五阶段：Controller 给前端提供接口</h2>
      <pre><code>@RestController
@RequestMapping("/device")
public class DeviceController {

    @Autowired
    private DeviceService deviceService;

    @GetMapping("/list")
    public List&lt;Device&gt; list() {
        return deviceService.list();
    }
}</code></pre>
      <p>前端访问 <code>GET /device/list</code>：</p>
      <pre class="flow">请求
 ↓
DeviceController
 ↓
DeviceService
 ↓
DeviceMapper
 ↓
MySQL</pre>
      <p>返回 JSON，又涉及：</p>
      <pre class="flow">List&lt;Device&gt;
   ↓
Jackson 序列化
   ↓
JSON</pre>

      <h2>第六阶段：Vue 前端调用</h2>
      <pre><code>axios.get("/device/list")
    .then(res => {
        console.log(res.data)
    })</code></pre>
      <pre class="flow">Vue
 ↓
axios 发送 HTTP 请求
 ↓
Spring Boot
 ↓
数据库
 ↓
返回 JSON
 ↓
Vue 拿到数据</pre>
      <pre><code>&lt;tr v-for="device in devices"&gt;
    &lt;td&gt;{{ device.id }}&lt;/td&gt;
    &lt;td&gt;{{ device.name }}&lt;/td&gt;
&lt;/tr&gt;</code></pre>

      <h2>第七阶段：新增设备</h2>
      <p>前端发：</p>
      <pre><code>{
    "name": "摄像头03",
    "status": 1
}</code></pre>
      <pre><code>@PostMapping("/add")
public void add(@RequestBody DeviceCreateRequest request) {
    deviceService.add(request);
}</code></pre>
      <pre class="flow">@RequestBody：
JSON → 反序列化 → Java 对象（DeviceCreateRequest）</pre>

      <h2>做完项目会串起来的知识</h2>
      <pre class="flow">Java类 / 对象 / new / 属性 / 方法
 ↓
Spring IOC / @Autowired / Bean
 ↓
Controller / @RequestBody / @GetMapping / @PostMapping
 ↓
JSON / 序列化 / 反序列化
 ↓
DTO / Entity
 ↓
Service / 业务逻辑
 ↓
MyBatis / Mapper / SQL
 ↓
MySQL
 ↓
HTTP
 ↓
Vue / Axios
 ↓
登录 / JWT / Interceptor / ThreadLocal
 ↓
异常处理 / 参数校验 / 日志 / 权限</pre>

      <h2>学习方式</h2>
      <p>不要「先把 Java 学完 → 再学 Spring → 再学数据库 → 半年后才开始项目」。更有效的是：</p>
      <pre class="flow">写项目
 ↓
碰到对象 → 学对象
碰到 JSON → 学序列化
碰到 @Autowired → 学 IOC
碰到登录 → 学 JWT
碰到 Interceptor → 学拦截器
碰到数据库慢 → 学索引</pre>
      <p>这样会知道<strong>这些技术到底为什么存在</strong>。学的时候也可以分三层：</p>
      <pre class="flow">会写
 ↓
知道为什么这样写
 ↓
知道底层是怎么工作的</pre>

      <h2>第一阶段目标</h2>
      <blockquote>
        <p><strong>自己能够完成一个 Vue + Spring Boot + MySQL 的 CRUD 项目，并且能解释一条请求从前端到数据库再回到前端的全过程。</strong></p>
      </blockquote>
      <p>达到这个程度，就已经真正开始进入 Java 后端开发了。</p>
      <p>下一步可以从「创建第一个 Spring Boot 项目」开始：一边写，一边搞清 <code>pom.xml</code>、启动类、Controller、注解、Bean 是什么，而不是直接把完整代码扔过来。</p>
    `,
  },
  {
    id: "springboot-user-admin-crud",
    category: "Spring Boot 开发",
    order: 20,
    title: "用户管理 CRUD：从查询列表到 POST 新增",
    summary: "用 Spring Boot、MyBatis 和 MySQL 跑通查询与新增用户链路",
    related: [
      "springboot-fullstack-roadmap",
      "java-spring-annotations",
      "java-object-json-serialize",
      "java-object-create-dto",
      "what-is-intellij-idea",
    ],
    content: `
      <span class="article-tag">Spring Boot 开发 · 项目实战</span>
      <h1>用户管理 CRUD：从查询列表到 POST 新增</h1>
      <p class="lead">这个项目的第一阶段目标不是一次写完所有功能，而是先跑通 <strong>HTTP 请求 → Controller → Service → Mapper → MySQL → JSON 响应</strong>。目前已经完成查询列表（Read）和 POST 新增（Create）；下一步再补修改和删除。</p>

      <h2 id="user-admin-goal" data-toc="目标与学习方式">项目目标与学习方式</h2>
      <p>用需求带动知识学习：</p>
      <pre class="flow">遇到需求
  ↓
先写出可运行的代码
  ↓
遇到问题时补对应理论
  ↓
理解并修正代码
  ↓
继续下一个功能</pre>
      <p>阶段目标是能独立解释并实现：</p>
      <pre class="flow">Controller：接收请求、返回结果
      ↓
Service：组织业务逻辑
      ↓
Mapper：执行数据库操作
      ↓
MySQL：保存业务数据</pre>

      <h2 id="user-admin-environment" data-toc="环境与技术栈">环境与技术栈</h2>
      <table>
        <thead><tr><th>工具 / 技术</th><th>本项目中的作用</th></tr></thead>
        <tbody>
          <tr><td>Windows 11</td><td>本地开发环境</td></tr>
          <tr><td>IntelliJ IDEA</td><td>编写、运行和调试代码</td></tr>
          <tr><td>JDK 21</td><td>编译和运行 Java</td></tr>
          <tr><td>Spring Boot</td><td>搭建 Web 后端应用</td></tr>
          <tr><td>Maven</td><td>管理依赖、编译和打包</td></tr>
          <tr><td>MyBatis</td><td>通过 Mapper 执行 SQL</td></tr>
          <tr><td>Docker MySQL</td><td>提供本地数据库服务</td></tr>
          <tr><td>Lombok</td><td>减少 getter、setter 等模板代码</td></tr>
        </tbody>
      </table>
      <p>笔记中验证过的组合是 Spring Boot 3.5.6、JDK 21、MyBatis 3.0.4 和 MySQL 8。它代表该项目当时可工作的版本组合，不意味着其他版本一定不能使用；新项目应优先按 Spring Initializr 和各组件官方兼容说明选择版本。</p>

      <h2 id="user-admin-structure" data-toc="项目结构">创建项目与目录结构</h2>
      <pre class="flow">user-admin/
├── pom.xml
└── src/main/
    ├── java/com/example/useradmin/
    │   ├── UserAdminApplication.java
    │   ├── controller/
    │   ├── service/
    │   ├── mapper/
    │   └── entity/
    └── resources/
        └── application.yml</pre>
      <p><code>pom.xml</code> 描述项目依赖和构建方式；Java 代码放在 <code>src/main/java</code>，配置文件放在 <code>src/main/resources</code>。</p>

      <h2 id="user-admin-startup" data-toc="启动过程">Spring Boot 如何启动</h2>
      <pre><code>@SpringBootApplication
public class UserAdminApplication {

    public static void main(String[] args) {
        SpringApplication.run(UserAdminApplication.class, args);
    }
}</code></pre>
      <pre class="flow">执行 main 方法
  ↓
SpringApplication.run()
  ↓
创建 Spring 容器
  ↓
从启动类所在包向下扫描组件
  ↓
创建并管理 Bean
  ↓
启动内嵌 Web 服务器
  ↓
监听端口，等待 HTTP 请求</pre>
      <p><code>@SpringBootApplication</code> 是组合注解，包含自动配置、组件扫描和配置类等能力。Spring Boot 3 默认使用内嵌 Tomcat，但也可以替换为其他受支持的 Web 服务器。</p>

      <h2 id="user-admin-hello" data-toc="第一个接口">第一个 Hello 接口</h2>
      <pre><code>@RestController
public class HelloController {

    @GetMapping("/hello")
    public String hello() {
        return "Hello Spring Boot";
    }
}</code></pre>
      <p>访问 <code>GET http://localhost:8080/hello</code> 时，Spring 根据路径找到 <code>hello()</code> 方法，并把返回值写入 HTTP 响应。</p>
      <ul>
        <li><code>@RestController</code>：声明这个类负责处理 Web 请求，方法返回值直接作为响应体。</li>
        <li><code>@GetMapping("/hello")</code>：把 GET 请求路径映射到这个方法。</li>
        <li><code>return</code>：返回给客户端的数据，不是页面跳转。</li>
      </ul>

      <h2 id="user-admin-json" data-toc="对象返回 JSON">Java 对象为什么变成 JSON</h2>
      <pre><code>@Data
public class User {
    private Long id;
    private String username;
    private Integer age;
}</code></pre>
      <pre><code>@GetMapping("/user")
public User user() {
    User user = new User();
    user.setId(1L);
    user.setUsername("张三");
    user.setAge(20);
    return user;
}</code></pre>
      <pre class="flow">Controller 返回 User 对象
  ↓
Spring MVC 选择消息转换器
  ↓
Jackson 将对象序列化
  ↓
HTTP 响应中的 JSON</pre>
      <p><code>@Data</code> 由 Lombok 提供，通常会生成 getter、setter、<code>toString</code>、<code>equals</code> 和 <code>hashCode</code>。它减少模板代码，但对象和方法仍然真实存在于编译结果中。</p>
      <p class="jump-row">
        <button class="jump-link" type="button" data-id="java-object-json-serialize">深入：Java 对象、JSON 与序列化 →</button>
        <button class="jump-link" type="button" data-id="java-spring-annotations/ann-lombok">相关：Lombok @Data →</button>
      </p>

      <h2 id="user-admin-database" data-toc="数据库与连接">创建数据库并配置连接</h2>
      <pre><code>CREATE DATABASE user_admin;
USE user_admin;

CREATE TABLE user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    age INT
);

INSERT INTO user (username, age)
VALUES ('Zhangsan', 20), ('Lisi', 22);

SELECT * FROM user;</code></pre>
      <p>学习项目可以让 Entity 字段先与表字段保持一致。真实项目中还要考虑唯一约束、非空约束、字段长度、创建时间和数据是否允许为空。</p>
      <pre><code>spring:
  application:
    name: user-admin
  datasource:
    url: jdbc:mysql://localhost:3306/user_admin
    username: root
    password: \${DB_PASSWORD}
    driver-class-name: com.mysql.cj.jdbc.Driver</code></pre>
      <p>JDBC URL 可以拆成：</p>
      <pre class="flow">jdbc:mysql://localhost:3306/user_admin
协议与驱动   主机名    端口   数据库名</pre>
      <blockquote>
        <p>示例使用环境变量 <code>DB_PASSWORD</code>，避免把真实数据库密码提交到 Git。若本地暂时直接填写密码，也不要把包含密码的配置推送到远程仓库。</p>
      </blockquote>

      <h2 id="user-admin-query" data-toc="查询完整链路">Mapper、Service、Controller 查询链路</h2>
      <h3>Mapper：访问数据库</h3>
      <pre><code>@Mapper
public interface UserMapper {

    @Select("SELECT id, username, age FROM user")
    List&lt;User&gt; selectAll();
}</code></pre>
      <h3>Service：组织业务</h3>
      <pre><code>@Service
public class UserService {

    private final UserMapper userMapper;

    public UserService(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    public List&lt;User&gt; list() {
        return userMapper.selectAll();
    }
}</code></pre>
      <p>这里使用构造器注入：依赖明确、便于测试，也不需要在字段上使用 <code>@Autowired</code>。</p>
      <h3>Controller：暴露接口</h3>
      <pre><code>@RestController
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/user/list")
    public List&lt;User&gt; list() {
        return userService.list();
    }
}</code></pre>
      <p>本项目实际访问 <code>GET /user/list</code>。完整执行过程是：</p>
      <pre class="flow">客户端发送请求
  ↓
内嵌 Tomcat 接收连接
  ↓
DispatcherServlet 分发请求
  ↓
UserController.list()
  ↓
UserService.list()
  ↓
UserMapper.selectAll()
  ↓
MySQL 返回数据
  ↓
MyBatis 映射为 List&lt;User&gt;
  ↓
Jackson 序列化为 JSON
  ↓
返回客户端</pre>

      <h2 id="user-admin-create" data-toc="POST 新增用户">POST 新增用户：完整链路</h2>
      <p>新增需求是：客户端提交用户名和年龄，服务端把数据保存到 MySQL。请求示例：</p>
      <pre><code>POST http://localhost:8080/user
Content-Type: application/json

{
    "username": "WangWu",
    "age": 18
}</code></pre>
      <pre class="flow">客户端 / Postman / Apifox
  ↓ POST /user + JSON
UserController.insert(@RequestBody User user)
  ↓ JSON 反序列化为 User 对象
UserService.insert(user)
  ↓
UserMapper.insert(user)
  ↓ MyBatis 绑定参数
INSERT INTO user(username, age) VALUES (?, ?)
  ↓
MySQL 新增一行，返回受影响行数 rows
  ↓ rows == 1
客户端收到“新增成功”</pre>
      <p>和 GET 查询的区别是：GET 把数据库数据取出来返回；POST 把请求数据送进来并执行 <code>INSERT</code> 保存。</p>

      <h3>Mapper：声明 INSERT 和参数</h3>
      <pre><code>@Mapper
public interface UserMapper {

    @Select("SELECT id, username, age FROM user")
    List&lt;User&gt; selectAll();

    @Insert("INSERT INTO user (username, age) VALUES (#{username}, #{age})")
    int insert(User user);
}</code></pre>
      <p><code>@Insert</code> 告诉 MyBatis：调用这个接口方法时执行对应的 INSERT SQL。<code>#{username}</code> 和 <code>#{age}</code> 来自传入的 <code>User</code> 对象属性，近似会变成带参数绑定的：</p>
      <pre><code>INSERT INTO user (username, age) VALUES (?, ?)</code></pre>
      <p>这里不是简单地把字符串拼进 SQL；MyBatis 会绑定参数，这也是避免常见 SQL 注入问题的重要原因之一。</p>
      <p>Mapper 是接口也没关系：MyBatis 会在运行时创建代理对象，按照注解中的 SQL 执行数据库操作，不需要自己手写 JDBC 连接和结果处理模板。</p>

      <h3><code>int insert(User user)</code> 到底是什么意思</h3>
      <pre class="flow">int          insert       (User user)
返回值类型    方法名          参数：类型 + 变量名</pre>
      <ul>
        <li><code>int</code>：执行后返回整数，通常表示受影响的行数。</li>
        <li><code>insert</code>：方法名，表示新增操作。</li>
        <li><code>User user</code>：接收一个 User 对象。</li>
        <li>接口方法声明以分号结束，不需要方法体。</li>
      </ul>
      <p>新增一行时通常得到 <code>rows == 1</code>；这个 <code>1</code> 表示影响了一行，<strong>不是新用户的 ID</strong>。自增 ID 由 MySQL 根据 <code>AUTO_INCREMENT</code> 生成。</p>

      <h3>Service：传递对象并保留业务层</h3>
      <pre><code>@Service
public class UserService {

    private final UserMapper userMapper;

    public UserService(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    public List&lt;User&gt; list() {
        return userMapper.selectAll();
    }

    public int insert(User user) {
        return userMapper.insert(user);
    }
}</code></pre>
      <p>当前新增只调用一行 Mapper，但以后可以在 Service 中加入用户名重复检查、业务规则、事务和日志。Controller 接收请求，Mapper 专注 SQL，职责仍然清晰。</p>
      <p>要区分方法<strong>定义</strong>和<strong>调用</strong>：</p>
      <pre><code>// 定义：声明参数类型和变量名
int insert(User user);

// 调用：只传入已有变量
userMapper.insert(user);</code></pre>
      <p>不能把 <code>userMapper.insert(User user)</code> 当作调用写法；调用时不能重复声明参数类型。</p>

      <h3>Controller：接收 JSON 并判断结果</h3>
      <pre><code>@PostMapping("/user")
public String insert(@RequestBody User user) {
    int rows = userService.insert(user);
    if (rows == 1) {
        return "新增成功";
    }
    return "新增失败";
}</code></pre>
      <p><code>@RequestBody</code> 让 Spring MVC 从 HTTP Body 读取 JSON，并通过 Jackson 反序列化成 <code>User</code> 对象。近似可以理解成：</p>
      <pre><code>User user = new User();
user.setUsername("WangWu");
user.setAge(18);</code></pre>
      <p>如果把 Service 错写成 <code>public User insert()</code>，就会同时出现三个问题：没有接收待新增对象、返回类型与 Mapper 的 <code>int</code> 不匹配、调用时错误地声明了 <code>User user</code>。正确结构是 <code>public int insert(User user)</code>。</p>

      <h2 id="user-admin-post-test" data-toc="测试 POST 接口">如何测试 POST 新增</h2>
      <p>浏览器地址栏通常发送 GET，不能只把 POST 地址粘进去；新增需要请求方法、请求头和 JSON Body。</p>
      <h3>Postman / Apifox</h3>
      <ol>
        <li>请求方式选择 <code>POST</code>。</li>
        <li>URL 填 <code>http://localhost:8080/user</code>。</li>
        <li>Body 选择 raw，格式选择 JSON。</li>
        <li>填写 <code>{"username":"WangWu","age":18}</code> 并发送。</li>
        <li>当前练习版正常新增一行会返回 <code>新增成功</code>。</li>
      </ol>
      <h3>Windows PowerShell</h3>
      <pre><code>Invoke-RestMethod -Uri "http://localhost:8080/user" -Method Post -ContentType "application/json" -Body '{"username":"WangWu","age":18}'</code></pre>
      <p>测试前确认 Spring Boot 应用和 Docker 中的 MySQL 都在运行。接口返回成功后，再执行 SQL 验证数据：</p>
      <pre><code>USE user_admin;

SELECT * FROM user;

SELECT id, username, age
FROM user
WHERE username = 'WangWu';</code></pre>
      <p>接口返回“新增成功”说明代码判断通过；SQL 查询能确认数据确实落到了数据库中。自增 ID 不一定是 3，要以数据库实际状态为准。</p>

      <h2 id="user-admin-create-pitfalls" data-toc="新增常见错误">POST 新增常见错误</h2>
      <table>
        <thead><tr><th>问题</th><th>原因</th><th>正确思路</th></tr></thead>
        <tbody>
          <tr><td><code>public User insert()</code></td><td>没有参数，且返回类型不是 Mapper 的 int</td><td><code>public int insert(User user)</code></td></tr>
          <tr><td><code>insert(User user)</code> 用在调用处</td><td>调用时重复声明参数类型</td><td><code>insert(user)</code></td></tr>
          <tr><td>忘记 <code>@RequestBody</code></td><td>请求 JSON 无法按预期绑定到 User</td><td><code>@RequestBody User user</code></td></tr>
          <tr><td>把返回的 1 当成用户 ID</td><td>MyBatis INSERT 返回受影响行数</td><td>新 ID 由数据库自增生成</td></tr>
          <tr><td>删除原来的 <code>selectAll()</code></td><td>新增功能不应破坏已有查询</td><td>在 Mapper、Service、Controller 中追加方法</td></tr>
          <tr><td><code>#{username}</code> 拼错</td><td>参数名与 User 属性不一致</td><td>与 <code>username</code>、<code>age</code> 保持一致</td></tr>
        </tbody>
      </table>
      <p>数据库连接失败或 SQL 执行失败时，异常可能直接返回错误响应，不一定会走到“新增失败”。后续应补充参数校验、统一异常处理和统一响应结构。</p>

      <h2 id="user-admin-troubleshooting" data-toc="常见错误排查">两个常见启动错误</h2>
      <h3>找不到 UserMapper Bean</h3>
      <pre><code>required a bean of type 'UserMapper' that could not be found</code></pre>
      <p>先确认 Mapper 接口带有 <code>@Mapper</code>，并且位于启动类所在包或其子包。也可以在配置类或启动类上统一使用：</p>
      <pre><code>@MapperScan("com.example.useradmin.mapper")</code></pre>
      <h3>缺少 SqlSessionFactory 或 SqlSessionTemplate</h3>
      <pre><code>Property 'sqlSessionFactory' or 'sqlSessionTemplate' are required</code></pre>
      <p>这通常表示 MyBatis 自动配置没有正确生效。依次检查：</p>
      <ol>
        <li>是否引入适配当前 Spring Boot 版本的 MyBatis Spring Boot Starter，而不是只引入 MyBatis 核心包。</li>
        <li>数据源 URL、账号、密码和 MySQL 驱动是否正确。</li>
        <li>Maven 是否成功加载依赖，是否混用了不兼容的 starter 版本。</li>
        <li>是否手动定义了不完整的 MyBatis 配置，覆盖了自动配置。</li>
      </ol>
      <p>把项目切换到一组已验证版本可以帮助定位问题，但不能简单归因于“某个 Spring Boot 大版本一定和 MyBatis 不兼容”。根因仍应以依赖树和启动日志为准。</p>

      <h2 id="user-admin-next" data-toc="下一步：完成 CRUD">下一步：补齐完整 CRUD</h2>
      <p>CRUD 分别是 Create、Read、Update、Delete。目前已经完成查询列表（Read）和 POST 新增（Create）：</p>
      <table>
        <thead><tr><th>能力</th><th>HTTP 接口</th><th>SQL</th><th>状态</th></tr></thead>
        <tbody>
          <tr><td>查询列表</td><td><code>GET /users</code></td><td><code>SELECT</code></td><td>已完成</td></tr>
          <tr><td>新增用户</td><td><code>POST /user</code></td><td><code>INSERT</code></td><td>已完成</td></tr>
          <tr><td>修改用户</td><td><code>PUT /users/{id}</code></td><td><code>UPDATE</code></td><td>待完成</td></tr>
          <tr><td>删除用户</td><td><code>DELETE /users/{id}</code></td><td><code>DELETE</code></td><td>待完成</td></tr>
        </tbody>
      </table>
      <p>下一步是实现修改和删除：建立 <code>UserUpdateRequest</code> 等 DTO，学习 <code>@PutMapping</code>、<code>@PathVariable</code> 和 MyBatis 的 <code>@Update</code> / <code>@Delete</code>，并补充参数校验、统一异常处理和接口测试。</p>
      <p class="jump-row">
        <button class="jump-link" type="button" data-id="java-object-create-dto">下一步基础：DTO 与参数映射 →</button>
        <button class="jump-link" type="button" data-id="java-spring-annotations/ann-params">相关：@RequestBody 接收参数 →</button>
        <button class="jump-link" type="button" data-id="java-spring-annotations/ann-valid">相关：参数校验 →</button>
      </p>

      <h2 id="user-admin-interview" data-toc="面试表达">面试怎么表达</h2>
      <h3>Spring Boot 请求流程</h3>
      <blockquote>
        <p>客户端请求先由内嵌 Web 服务器接收，再交给 Spring MVC 的 DispatcherServlet。DispatcherServlet 根据映射找到 Controller 方法；POST 请求中的 JSON 会先由消息转换器反序列化成 Java 对象，Controller 再调用 Service，Service 调用 Mapper 访问数据库。查询结果或操作结果最后由消息转换器写回 HTTP 响应。</p>
      </blockquote>
      <h3>三层架构</h3>
      <blockquote>
        <p>Controller 负责协议层的请求和响应，Service 负责业务规则与流程，Mapper 负责数据访问。分层可以降低职责耦合，让代码更容易维护和测试。</p>
      </blockquote>
      <h3>MyBatis</h3>
      <blockquote>
        <p>MyBatis 是持久层框架，通过 Mapper 和 SQL 映射帮助 Java 程序访问数据库，减少手写 JDBC 的连接管理、参数设置和结果集转换代码，同时保留对 SQL 的直接控制。</p>
      </blockquote>
    `,
  },
  {
    id: "java-spring-annotations",
    category: "Spring Boot 开发",
    order: 10,
    title: "Spring Boot 常用注解",
    summary: "按用途掌握组件、接口、校验、事务等常用注解",
    related: [
      "springboot-fullstack-roadmap",
      "db-isolation-locks",
      "case-concurrent-withdraw",
      "interceptor-threadlocal",
      "springboot-user-admin-crud",
    ],
    content: `
      <span class="article-tag">Spring Boot 开发</span>
      <h1>Spring Boot 常用注解</h1>
      <p class="lead">在 Java 后端里，<code>@xxx</code> 叫<strong>注解 Annotation</strong>。你可以先把它理解成：</p>
      <blockquote>
        <p><strong>给类、方法、字段、参数加「标记」，让编译器或 Spring 知道该怎么处理它。</strong></p>
      </blockquote>
      <pre><code>@RestController
public class UserController {
}</code></pre>
      <p>意思不是「执行一个方法」，而是告诉 Spring：这个类是 Controller，请交给 Spring 管理，并且方法返回值默认作为 HTTP 响应体。右侧目录可点选跳转到对应注解分类。</p>

      <h2 id="ann-bean" data-toc="组件 / Bean">1. 组件 / Bean 相关</h2>
      <pre><code>@Component   // 普通 Spring 组件
@Service     // 业务层
@Repository  // 数据访问层
@Controller  // MVC 控制器
@RestController // REST 接口控制器</code></pre>
      <p><code>@RestController</code> 基本等于 <code>@Controller + @ResponseBody</code>。它们核心作用都是：</p>
      <blockquote>
        <p><strong>让 Spring 创建并管理这个对象</strong>，也就是注册成 Bean。</p>
      </blockquote>

      <h2 id="ann-inject" data-toc="依赖注入 @Autowired">2. 依赖注入</h2>
      <pre><code>@Autowired
private UserService userService;</code></pre>
      <p>意思：从 Spring 容器中找到一个 <code>UserService</code> 对象，注入进来。现在更推荐<strong>构造器注入</strong>：</p>
      <pre><code>private final UserService userService;

public UserController(UserService userService) {
    this.userService = userService;
}</code></pre>
      <p>配合 Lombok：</p>
      <pre><code>@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
}</code></pre>

      <h2 id="ann-mapping" data-toc="接口映射 @GetMapping">3. Controller 接口相关</h2>
      <ul>
        <li><code>@RequestMapping("/user")</code>：定义 URL，常放类上</li>
        <li><code>@GetMapping("/list")</code>：GET，一般用于查询</li>
        <li><code>@PostMapping("/add")</code>：POST，一般用于新增 / 提交</li>
        <li><code>@PutMapping("/update")</code>：通常表示修改</li>
        <li><code>@DeleteMapping("/{id}")</code>：通常表示删除</li>
      </ul>

      <h2 id="ann-params" data-toc="接参 @RequestBody">4. 接收前端参数</h2>
      <h3>@RequestBody — 接 JSON</h3>
      <pre><code>@PostMapping("/add")
public void add(@RequestBody UserDTO dto) {
}</code></pre>
      <pre class="flow">JSON → 反序列化 → UserDTO 对象</pre>

      <h3>@RequestParam — 接 URL 参数</h3>
      <pre><code>@GetMapping("/find")
public User find(@RequestParam Long id) {
}
// /user/find?id=10</code></pre>

      <h3>@PathVariable — 接路径参数</h3>
      <pre><code>@GetMapping("/{id}")
public User find(@PathVariable Long id) {
}
// /user/10 → id = 10</code></pre>

      <h3>@RequestHeader — 取请求头</h3>
      <pre><code>@RequestHeader("Authorization") String token</code></pre>
      <p>常用于 Token / JWT / 用户认证。</p>

      <h2 id="ann-valid" data-toc="参数校验 @Valid">5. 参数校验</h2>
      <pre><code>public class UserDTO {
    @NotBlank
    private String username;

    @NotNull
    private Integer age;

    @Min(0)
    private Integer score;
}

public void add(@Valid @RequestBody UserDTO dto) {
}</code></pre>
      <pre class="flow">@NotNull   不能为 null
@NotBlank  字符串不能为空
@NotEmpty  集合/字符串不能为空
@Min / @Max
@Size      长度限制
@Pattern   正则校验</pre>

      <h2 id="ann-config" data-toc="配置 @Configuration">6. 配置相关</h2>
      <ul>
        <li><code>@Configuration</code>：配置类</li>
        <li><code>@Bean</code>：手动创建并由 Spring 管理的对象</li>
        <li><code>@Value("\${server.port}")</code>：读取单项配置</li>
        <li><code>@ConfigurationProperties</code>：一组配置映射成 Java 对象，复杂配置更合适</li>
      </ul>

      <h2 id="ann-mybatis" data-toc="MyBatis @Mapper">7. 数据库 / MyBatis</h2>
      <pre><code>@Mapper
public interface UserMapper {

    @Select("select * from user where id = #{id}")
    User findById(Long id);
}</code></pre>
      <p>还有 <code>@Insert</code> / <code>@Update</code> / <code>@Delete</code>。正式项目复杂 SQL 更多用 XML 或 MyBatis-Plus。</p>

      <h2 id="ann-tx" data-toc="事务 @Transactional">8. 事务</h2>
      <pre><code>@Transactional
public void transfer() {
}</code></pre>
      <p>作用：方法里数据库操作要么全部成功，要么全部回滚。底层主要是 Spring AOP + 数据库事务。</p>
      <blockquote>
        <p>常见坑：<code>@Transactional</code> 一般需要通过 Spring 代理调用才生效，同类内部直接调用可能导致事务失效。面试很爱问。</p>
      </blockquote>
      <p>注意：它<strong>不能单独解决多事务并发竞争</strong>（例如两个人同时扣同一账户）。</p>
      <p class="jump-row">
        <button class="jump-link" type="button" data-id="db-isolation-locks">含义：事务隔离与并发锁 →</button>
        <button class="jump-link" type="button" data-id="case-concurrent-withdraw">场景解析：并发扣款 →</button>
      </p>

      <h2 id="ann-exception" data-toc="异常处理 @ExceptionHandler">9. 异常处理</h2>
      <pre><code>@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(RuntimeException.class)
    public String handle(RuntimeException e) {
        return e.getMessage();
    }
}</code></pre>

      <h2 id="ann-lombok" data-toc="Lombok @Data">10. Lombok</h2>
      <p>不是 Spring。常见 <code>@Data</code> 自动生成 getter / setter / toString / equals / hashCode。还有：</p>
      <pre class="flow">@Getter @Setter @Builder
@NoArgsConstructor @AllArgsConstructor
@RequiredArgsConstructor @Slf4j</pre>

      <h2 id="ann-json" data-toc="JSON @JsonProperty">11. JSON 相关（Jackson）</h2>
      <pre><code>@JsonProperty("user_name")
private String userName;

@JsonIgnore
private String password; // 不序列化到 JSON</code></pre>

      <h2 id="ann-async" data-toc="定时 / 异步 @Async">12. 定时任务 / 异步</h2>
      <pre><code>@EnableScheduling
@Scheduled(cron = "0 0 1 * * ?")  // 例如每天凌晨 1 点

@EnableAsync
@Async  // 放到其他线程执行</code></pre>
      <p>以后会联系到：线程池、ThreadLocal、异步任务。</p>

      <h2 id="ann-aop" data-toc="AOP @Aspect">13. AOP</h2>
      <pre><code>@Aspect
@Around / @Before / @After</code></pre>
      <p>常用于：操作日志、接口耗时、权限、统一审计。</p>

      <h2 id="ann-priority" data-toc="优先掌握清单">目前最应该先掌握的</h2>
      <p>别一次背几十个。做 Spring Boot 项目先牢记：</p>
      <pre class="flow">@RestController
@RequestMapping
@GetMapping / @PostMapping

@RequestBody / @RequestParam / @PathVariable

@Service / @Mapper

@Autowired / 构造器注入

@Data

@Transactional

@RestControllerAdvice / @ExceptionHandler</pre>

      <h2 id="ann-principle" data-toc="底层原理">从底层理解注解</h2>
      <pre><code>@Service
public class UserService {
}</code></pre>
      <p>注解本身只是<strong>元数据 / 标记</strong>。真正起作用的是 Spring：</p>
      <pre class="flow">Spring 启动
↓
扫描 class
↓
发现 @Service
↓
通过反射读取注解
↓
创建 UserService 对象
↓
放入 IOC 容器
↓
以后其他地方可以注入</pre>
      <blockquote>
        <p>注解本身主要是元数据，Spring 在启动或运行过程中通过扫描和反射读取这些注解，再根据不同注解执行 Bean 注册、依赖注入、请求映射、事务代理等逻辑。</p>
      </blockquote>
    `,
  },
  {
    id: "seckill-redis-mq",
    category: "数据库与高并发",
    order: 30,
    title: "秒杀系统：Redis、MQ 与一致性",
    summary: "从鉴权削峰到原子扣库存、异步落库和最终一致性",
    related: [
      "interceptor-threadlocal",
      "java-spring-annotations",
      "db-isolation-locks",
      "case-concurrent-withdraw",
    ],
    content: `
      <span class="article-tag">数据库与高并发</span>
      <h1>秒杀系统：Redis、MQ 与一致性</h1>
      <p class="lead">这是 Java 后端非常经典的架构：<strong>高并发秒杀 = 网关鉴权 + Redis 原子扣库存 + MQ 异步削峰 + MySQL 最终落库</strong>。整体思路对，但有几个底层概念必须分清。</p>

      <h2>一、完整请求流程</h2>
      <pre class="flow">请求进入
 ↓
Gateway：Token / 黑名单 / 限流
 ↓
秒杀接口：拼 JSON 报文（尽量只做内存操作）
 ↓
Redis：原子判断库存 + 预扣 + 去重
 ↓
通过 → 发 MQ → 快速返回「排队中」
 ↓
MQ 消费者按库承受能力创建订单
 ↓
MySQL 落库</pre>
      <p>成功预扣库存后，接口可以快速返回「排队中」，不必等数据库创建订单。前台接口目标是尽量快（比如十几毫秒级），但 <strong>20ms 是优化目标，不是保证值</strong>。</p>

      <h2>二、核心知识点</h2>

      <h3>1. Gateway 拦截 Token</h3>
      <ul>
        <li>没有 Token：拒绝需要登录的请求</li>
        <li>Token 无效或过期：拒绝</li>
        <li>Token 在黑名单：拒绝（用于提前作废尚未过期的 Token）</li>
        <li>请求太频繁：限流，防刷</li>
      </ul>
      <p>登录接口、公开接口需要放行。</p>

      <h3>2. Redis 为什么能解决超卖？</h3>
      <p><strong>超卖</strong>：库存只有 10，却成功卖出 15。普通代码：</p>
      <pre><code>if (stock > 0) {
    stock--;
}</code></pre>
      <p>多个线程可能同时看到 <code>stock > 0</code>，一起扣减。Redis 的 <code>DECR</code> / <code>INCR</code> 具有原子性，但秒杀还要判断库存、是否重复购买，所以常用 <strong>Lua 脚本</strong>把多步合成一个原子单元。</p>
      <blockquote>
        <p>Redis 传统命令执行主要是单线程模型，但不代表 Redis 所有工作只有一个线程，也不代表所有业务流程天然原子。</p>
      </blockquote>

      <h3>3. 数据库线程打满</h3>
      <p>若连接池只有 100，瞬间 10 万秒杀请求直打 MySQL：连接耗尽、行锁竞争、超时积压、服务器负载飙升。所以要减少同步打库。</p>

      <h3>4. MQ 削峰填谷</h3>
      <pre class="flow">10 万请求瞬间到来
 ↓
Redis 快速筛有资格的
 ↓
MQ 缓冲订单任务
 ↓
消费者按库能力慢慢处理
 ↓
MySQL</pre>
      <blockquote>
        <p><strong>原子性 ≠ 排队</strong>。Redis 原子解决并发下库存对不对；MQ 解决请求瞬间太多、库扛不住。</p>
      </blockquote>

      <h2>三、为什么秒杀接口只拼 JSON？</h2>
      <pre><code>SeckillMessage message = new SeckillMessage();
message.setUserId(1001L);
message.setProductId(2001L);
message.setOrderId(3001L);

String json = objectMapper.writeValueAsString(message);
mqProducer.send(json);</code></pre>
      <p>这个 JSON 就是消息体（报文的一种）。接口快速返回：</p>
      <pre><code>{
  "code": 202,
  "message": "排队中",
  "orderId": 3001
}</code></pre>
      <p>真正建单由消费者异步做，避免同步打崩服务器。</p>

      <h2>四、开发最要注意</h2>
      <table>
        <thead>
          <tr><th>问题</th><th>解决方案</th></tr>
        </thead>
        <tbody>
          <tr><td>超卖</td><td>Redis Lua 原子预扣 + 数据库条件扣减</td></tr>
          <tr><td>一人重复抢</td><td>Redis 原子去重 + 数据库唯一约束</td></tr>
          <tr><td>MQ 重复消费</td><td>订单幂等处理</td></tr>
          <tr><td>MQ 发送失败</td><td>可靠消息或补偿</td></tr>
          <tr><td>数据库扛不住</td><td>控制消费并发、限流、削峰</td></tr>
          <tr><td>Redis 与 MySQL 不一致</td><td>补偿、对账、最终一致性</td></tr>
        </tbody>
      </table>
      <p>特别强调：<strong>Redis 扣库存成功 ≠ 订单最终成功</strong>。消息丢失、库失败要补偿；MQ 也要有容量与过载保护，否则只是把压力挪地方。</p>

      <h2>五、面试回答</h2>
      <blockquote>
        <p>秒杀系统为了应对瞬时高并发，通常在网关层认证和限流，通过 Redis Lua 实现库存判断、去重及预扣的原子性，再把合格订单任务发到 MQ。接口快速返回排队状态，由消费者异步执行数据库事务建单，同时用幂等、可靠消息和补偿保证最终一致性。</p>
      </blockquote>
      <p>真正要搞懂的三个底层问题：</p>
      <ol>
        <li>Redis 原子性为什么能防超卖？</li>
        <li>MQ 为什么能削峰，而不是让数据库变快？</li>
        <li>Redis 扣成功，但 MQ / MySQL 失败了，库存怎么办？</li>
      </ol>

      <section class="dig">
        <div class="dig-head">
          <span class="dig-label">深挖</span>
          <p class="dig-ask"><strong>疑问方向：</strong>自己试答上述三问——把 Redis 原子、MQ 削峰、跨系统失败混在一起了，该怎么纠正？</p>
        </div>
        <h2>纠正三个常见误解</h2>

        <h3>1. Redis 原子性为什么防超卖？</h3>
        <p>易错：以为 Redis 会判断 MySQL 库存。纠正：它操作的是 <strong>Redis 自己存的库存</strong>；原子性指执行中不会被其他命令插入打断。</p>
        <p>库存 <code>stock = 1</code>，三人同时抢。普通 Java 可能都读到 1 导致超卖。Lua：</p>
        <pre><code>local stock = tonumber(redis.call('GET', KEYS[1]))
if stock <= 0 then
    return 0
end
redis.call('DECR', KEYS[1])
return 1</code></pre>
        <pre class="flow">用户A → 库存1 → 扣成0 → 成功
用户B → 库存0 → 失败
用户C → 库存0 → 失败</pre>
        <blockquote>
          <p>Redis 通过原子命令或 Lua 保证库存检查与扣减的原子性，避免多请求读到旧库存。实际系统还要用数据库约束做最终保障。</p>
        </blockquote>

        <h3>2. MQ 为什么能削峰？</h3>
        <p>易错：以为重点是「传得快」。纠正：重点是 <strong>暂存大量任务，让库慢慢处理</strong>。MQ 没有让数据库每秒处理更多，而是把瞬时压力平摊到后续时间。</p>
        <pre class="flow">无 MQ：1 万请求同时打库 → 连接池耗尽
用 MQ：1 万任务进队列 → 消费者每秒 1000 → 库稳定</pre>
        <blockquote>
          <p>MQ 通过异步和缓冲实现削峰填谷：生产者快速提交，消费者按库承载处理，避免瞬时高并发直冲数据库。</p>
        </blockquote>

        <h3>3. Redis 扣成功、MySQL 失败怎么办？</h3>
        <p>易错：以为事务会自动回滚 Redis。纠正：<strong>Redis 和 MySQL 是两个系统</strong>，MySQL 本地事务不会自动回滚已成功的 Redis 操作，需要补偿：</p>
        <pre class="flow">Redis 预扣 10→9
 ↓
MQ / MySQL 建单失败
 ↓
确认最终失败后补偿
 ↓
Redis 库存 9→10</pre>
        <p>补偿还要防重复加库存，并处理消息丢失、超时、重复消费。这叫<strong>最终一致性</strong>：允许暂时不一致，通过可靠处理最终一致。</p>
        <blockquote>
          <p>MySQL 本地事务无法自动回滚 Redis。预扣成功但建单失败时，要用可靠消息、重试和幂等补偿保证最终一致。</p>
        </blockquote>

        <table>
          <thead>
            <tr><th>技术</th><th>最核心作用</th></tr>
          </thead>
          <tbody>
            <tr><td>Redis 原子操作</td><td>防并发争抢同一库存时算错</td></tr>
            <tr><td>MQ</td><td>缓冲任务、异步削峰</td></tr>
            <tr><td>MySQL 事务</td><td>保证库内一组操作的事务一致性</td></tr>
            <tr><td>补偿机制</td><td>处理跨系统失败后的不一致</td></tr>
          </tbody>
        </table>
      </section>

      <section class="dig">
        <div class="dig-head">
          <span class="dig-label">深挖</span>
          <p class="dig-ask"><strong>疑问方向：</strong>A 预扣成功、建单成功，但 ACK 丢了导致 MQ 再投递——如何防止 A 被建两个订单？（引出幂等性）</p>
        </div>
        <h2>幂等性 Idempotency</h2>
        <p><strong>幂等</strong>：同一操作执行一次和多次，最终业务效果相同。例如订单 1001 无论重试几次，最终只有一单。</p>
        <pre class="flow">消费者建单成功
 ↓
准备 ACK，网络异常未送达
 ↓
MQ 认为未确认 → 再投递
 ↓
若无幂等 → 可能重复建单</pre>

        <h3>常见做法：唯一订单号 + 唯一约束</h3>
        <pre><code>{
  "orderId": 1001,
  "userId": 2001,
  "productId": 3001
}</code></pre>
        <pre><code>ALTER TABLE orders
ADD CONSTRAINT uk_order_id UNIQUE (order_id);</code></pre>
        <p>第二次插入同 <code>orderId</code> 会 Duplicate；消费者识别为已成功处理的重复消息后直接 ACK。若业务是「一用户一场秒杀只能一次」，还要按业务规则做用户+活动唯一约束。</p>

        <h3>为什么不能只靠事务？</h3>
        <pre class="flow">第一次消息 → 事务插入 → 提交成功
第二次消息 → 新事务再插入 → 也可能提交成功</pre>
        <ul>
          <li><code>@Transactional</code>：一次事务内部一致性</li>
          <li>唯一约束：防重复数据</li>
          <li>幂等性：重复执行不产生额外业务效果</li>
        </ul>
        <p>还要区分异常：库临时故障可重试；已确认成功的重复消息应直接 ACK，不能把所有异常都当成功。</p>
        <blockquote>
          <p>幂等指同一业务操作重复执行不产生额外影响。MQ 可能重复投递，消费者要用唯一业务标识、唯一索引或 Redis 去重等保证不重复建单。事务管单次一致性，不能单独保证幂等。</p>
        </blockquote>
      </section>

      <section class="dig">
        <div class="dig-head">
          <span class="dig-label">深挖</span>
          <p class="dig-ask"><strong>疑问方向：</strong>转账接口超时重试时，如何判断是「同一笔重试」还是「用户真想再转一次」？</p>
        </div>
        <h2>转账场景的幂等：requestId</h2>
        <p>不能靠参数碰巧相同就当重复。应给每笔业务分配唯一 <code>requestId</code>：重试复用同一 ID，新业务用新 ID。</p>
        <pre><code>// 同一笔重试
{ "requestId": "TX10001", "fromUser": 1001, "toUser": 1002, "amount": 100 }

// 用户真想再转一笔
{ "requestId": "TX10002", "fromUser": 1001, "toUser": 1002, "amount": 100 }</code></pre>
        <pre><code>CREATE TABLE transfer_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    request_id VARCHAR(64) NOT NULL UNIQUE,
    amount DECIMAL(10,2)
);</code></pre>
        <table>
          <thead>
            <tr><th>方案</th><th>主要作用</th></tr>
          </thead>
          <tbody>
            <tr><td>Redis SET NX</td><td>快速识别 / 拦截重复请求</td></tr>
            <tr><td>MySQL UNIQUE</td><td>库层面防重复业务记录</td></tr>
            <tr><td>@Transactional</td><td>一次库事务内部一致性</td></tr>
          </tbody>
        </table>
        <p>转账等重要业务不能只靠 Redis（可能过期/丢失），要配合库唯一约束，并在同一事务里完成记录、扣款、入账。</p>
        <blockquote>
          <p>为每次业务分配唯一请求 ID；重试复用、新业务新 ID。可用 Redis 快速去重，并用数据库唯一约束保证不重复执行，再结合事务保证资金一致性。</p>
        </blockquote>
      </section>

      <section class="dig">
        <div class="dig-head">
          <span class="dig-label">深挖</span>
          <p class="dig-ask"><strong>疑问方向：</strong>A 扣款成功、B 入账失败时余额应是多少？如何保证两步同成同败？ACID 是什么？</p>
        </div>
        <h2>事务与 ACID</h2>
        <p>在<strong>同一事务</strong>里：A 扣成功、B 加失败 → 回滚 → A 仍是 100，B 仍是 50。若没开事务且 A 已提交，A 可能变成 0。</p>
        <p>易混点：「一个失败就回滚」体现的主要是<strong>原子性 Atomicity</strong>，不只是口头上的「一致性」。</p>
        <table>
          <thead>
            <tr><th>特性</th><th>英文</th><th>底层理解</th></tr>
          </thead>
          <tbody>
            <tr><td>A 原子性</td><td>Atomicity</td><td>一组操作全部成功或全部回滚</td></tr>
            <tr><td>C 一致性</td><td>Consistency</td><td>事务前后满足业务规则与约束</td></tr>
            <tr><td>I 隔离性</td><td>Isolation</td><td>并发事务控制相互影响</td></tr>
            <tr><td>D 持久性</td><td>Durability</td><td>提交后数据能持久保存</td></tr>
          </tbody>
        </table>
        <pre><code>@Transactional
public void transfer() {
    accountMapper.deduct(1001L, 100);
    accountMapper.add(1002L, 100);
}</code></pre>
        <pre class="flow">Spring 事务代理
 ↓
开启库事务
 ↓
扣款 / 入账
 ↓
全成功 → COMMIT
需回滚的异常 → ROLLBACK</pre>
        <ul>
          <li>默认主要对 <code>RuntimeException</code> / <code>Error</code> 回滚，不是所有异常</li>
          <li><code>catch</code> 住却不抛出 / 不标记回滚，可能被当成成功提交</li>
          <li>本地事务不自动回滚 Redis、MQ 等外部操作</li>
        </ul>
        <blockquote>
          <p>ACID：原子性、一致性、隔离性、持久性。Spring Boot 常用 <code>@Transactional</code> 管理数据库事务。</p>
        </blockquote>
        <p class="jump-row">
          <button class="jump-link" type="button" data-id="db-isolation-locks">含义：事务隔离与并发锁 →</button>
          <button class="jump-link" type="button" data-id="case-concurrent-withdraw">场景解析：并发扣款 →</button>
        </p>
      </section>
    `,
  },
  {
    id: "db-isolation-locks",
    category: "数据库与高并发",
    order: 10,
    title: "事务隔离与并发锁",
    summary: "理解事务边界，以及悲观锁、乐观锁和分布式锁",
    related: [
      "case-concurrent-withdraw",
      "seckill-redis-mq",
      "java-spring-annotations",
    ],
    content: `
      <span class="article-tag">数据库与高并发</span>
      <h1>事务隔离与并发锁</h1>
      <p class="lead"><code>@Transactional</code> 能管好<strong>一个事务内部</strong>的成败，但不能单独挡住<strong>多个事务同时改同一行数据</strong>时的竞争。这里补的是并发场景背后的含义：隔离性，以及三种常见锁思路。</p>

      <h2 id="iso-meaning" data-toc="隔离性是什么">隔离性 Isolation 是什么</h2>
      <p>ACID 里的 <strong>I</strong>：多个事务并发执行时，控制它们互相看到什么、能不能互相踩脚。</p>
      <pre class="flow">原子性：我这一组操作要么全成要么全败
隔离性：别人同时跑的时候，别把我的中间状态搞乱</pre>
      <p>所以会出现经典并发问题（后续可继续深挖各级隔离级别）：</p>
      <ul>
        <li><strong>脏读</strong>：读到别人还没提交的数据</li>
        <li><strong>不可重复读</strong>：同一事务里两次读同一行，结果不同（被人改了）</li>
        <li><strong>幻读</strong>：同一条件两次查询，行数变了（被人插入/删除）</li>
      </ul>
      <p>实际开发里，更常直接面对的是：<strong>读-改-写竞态</strong>（先查余额再扣款，两人都以为够扣）。</p>

      <h2 id="iso-vs-tx" data-toc="@Transactional 的边界">@Transactional 的边界</h2>
      <blockquote>
        <p><strong>@Transactional 可以保证一个事务内部的一致性，但不能阻止多个事务同时执行产生的数据竞争。</strong></p>
      </blockquote>
      <p>它保证的是「自己这组 SQL 的事务规则」，不是「同一时刻全世界只有我能改这行」。</p>

      <h2 id="iso-pessimistic" data-toc="悲观锁 / 行锁">悲观锁：数据库行锁</h2>
      <p>假设会冲突，先锁再改。MySQL 常见：</p>
      <pre><code>SELECT * FROM account WHERE id = 1 FOR UPDATE;</code></pre>
      <pre class="flow">A 锁行 → 扣款 → 提交放锁
B 等待 → 再读最新余额 → 再判断</pre>
      <p>适合冲突概率高、必须强一致的账户/库存关键路径；代价是等待与吞吐下降。</p>

      <h2 id="iso-optimistic" data-toc="乐观锁 version">乐观锁：version / 条件更新</h2>
      <p>假设冲突不多，更新时带上「我读到的版本」：</p>
      <pre><code>UPDATE account
SET balance = 20, version = version + 1
WHERE id = 1 AND version = 1;</code></pre>
      <p>影响行数为 0 就表示被人抢先改过了，需要重试或失败返回。互联网业务很常用。</p>

      <h2 id="iso-distributed" data-toc="分布式锁">分布式锁（Redis 等）</h2>
      <p>当临界区跨多个服务、不止一个数据库时，单库行锁管不过来，常用 Redis：</p>
      <pre><code>SET lock:user:1001 NX EX 30</code></pre>
      <p>拿到锁的实例才能进入关键逻辑。注意锁超时、续期、误删别人的锁等工程细节。</p>

      <h2 id="iso-chain" data-toc="和秒杀链路的关系">和秒杀链路怎么拼</h2>
      <pre class="flow">高并发请求
    ↓
Redis 限流 / 预扣（挡大部分）
    ↓
MQ 异步削峰
    ↓
数据库事务 + 锁 / 条件更新
    ↓
最终一致</pre>

      <p class="jump-row">
        <button class="jump-link" type="button" data-id="case-concurrent-withdraw">场景解析：并发扣款为何还需要锁 →</button>
        <button class="jump-link" type="button" data-id="seckill-redis-mq">回到：秒杀架构 →</button>
      </p>
    `,
  },
  {
    id: "case-concurrent-withdraw",
    category: "数据库与高并发",
    order: 20,
    title: "并发扣款：事务为什么不够",
    summary: "用两线程扣余额场景理解事务与并发控制",
    related: [
      "db-isolation-locks",
      "seckill-redis-mq",
      "java-spring-annotations",
    ],
    content: `
      <span class="article-tag">数据库与高并发 · 场景解析</span>
      <h1>并发扣款：事务为什么不够</h1>
      <p class="lead">对应问题：余额 100，两线程同时查到 100 各扣 80——都会成功吗？只有 <code>@Transactional</code> 够不够？</p>

      <div class="case-answer">
        <p class="case-answer-title">你的回答要点</p>
        <p>已经抓到关键点：<strong>@Transactional 不能解决所有并发问题</strong>。表述「只能保证一个事务」需修正为：</p>
        <blockquote>
          <p><strong>@Transactional 可以保证一个事务内部的一致性，但是不能阻止多个事务同时执行产生的数据竞争问题。</strong></p>
        </blockquote>
      </div>

      <p class="jump-row">
        <button class="jump-link" type="button" data-id="db-isolation-locks">先看含义：事务隔离与并发锁 →</button>
      </p>

      <h2 id="case-scene" data-toc="场景还原">场景还原</h2>
      <pre class="flow">账户余额 = 100

线程A：查到 100 ≥ 80，准备扣 80
线程B：查到 100 ≥ 80，准备扣 80

无额外控制 → 可能 100-80-80 = -60
（并发更新 / 超卖类问题）</pre>

      <h2 id="case-why" data-toc="为什么事务不够">为什么 @Transactional 不管用？</h2>
      <pre><code>@Transactional
public void withdraw(Long userId, int money){
    Account account = queryAccount(userId);
    if(account.getBalance() >= money){
        updateBalance(userId, money);
    }
}</code></pre>
      <pre class="flow">事务A 查余额 100
事务B 查余额 100
事务A 扣 80
事务B 扣 80
→ 两人都认为合法</pre>
      <p>事务保证：自己的操作全部成功或全部失败。它没有说：别人不能同时操作。所以需要隔离性 + 锁。</p>

      <h2 id="case-rowlock" data-toc="方案：行锁">方案 1：数据库行锁</h2>
      <pre><code>select * from account where id=1 for update;</code></pre>
      <pre class="flow">线程A → select for update → 锁住账户 → 扣款 → 提交 → 放锁
线程B → 等待 → 再查余额 20 → 不足 → 失败</pre>

      <h2 id="case-version" data-toc="方案：乐观锁">方案 2：乐观锁</h2>
      <pre><code>update account
set balance=20, version=version+1
where id=1 and version=1;</code></pre>
      <p>A 把 version 1→2 成功后，B 仍用 version=1 更新失败。</p>

      <h2 id="case-redislock" data-toc="方案：分布式锁">方案 3：Redis 分布式锁</h2>
      <p>多服务场景下单库锁不够时，用 <code>SET lock:user:1001 NX</code> 这类分布式锁串行化临界区。</p>

      <h2 id="case-interview" data-toc="面试回答">面试回答</h2>
      <blockquote>
        <p><code>@Transactional</code> 主要保证单个事务的原子性、一致性、隔离性和持久性，但不能完全解决多个事务并发访问导致的数据竞争。针对并发修改，需要结合数据库锁、乐观锁、悲观锁或分布式锁。</p>
      </blockquote>

      <p class="jump-row">
        <button class="jump-link" type="button" data-id="db-isolation-locks">含义：事务隔离与并发锁 →</button>
        <button class="jump-link" type="button" data-id="seckill-redis-mq">相关：秒杀架构 →</button>
        <button class="jump-link" type="button" data-id="java-spring-annotations/ann-tx">相关：@Transactional 注解 →</button>
      </p>
    `,
  },
  {
    id: "linux-common-commands",
    category: "Linux 与部署",
    order: 10,
    title: "Linux 常用命令与后端运维",
    summary: "文件、日志、权限、进程、服务、网络和远程部署速查",
    related: ["springboot-fullstack-roadmap"],
    content: `
      <span class="article-tag">Linux 与部署</span>
      <h1>Linux 常用命令与后端运维</h1>
      <p class="lead">学习 Linux 命令不要只背单词。先掌握「路径 + 命令 + 参数 + 管道」的组合方式，再围绕后端最常见的任务练习：找文件、看日志、查端口、管进程、重启服务和远程部署。</p>

      <h2 id="linux-basics" data-toc="命令与路径基础">命令与路径基础</h2>
      <p>大多数命令都可以拆成：</p>
      <pre><code>命令 [选项] [目标]
ls -lah /var/log</code></pre>
      <ul>
        <li><code>ls</code>：命令</li>
        <li><code>-lah</code>：选项，可将多个短选项合并</li>
        <li><code>/var/log</code>：操作目标</li>
      </ul>
      <table>
        <thead><tr><th>写法</th><th>含义</th><th>例子</th></tr></thead>
        <tbody>
          <tr><td><code>/</code></td><td>根目录</td><td><code>/var/log</code></td></tr>
          <tr><td><code>~</code></td><td>当前用户的家目录</td><td><code>cd ~</code></td></tr>
          <tr><td><code>.</code></td><td>当前目录</td><td><code>./deploy.sh</code></td></tr>
          <tr><td><code>..</code></td><td>上一级目录</td><td><code>cd ..</code></td></tr>
          <tr><td><code>/opt/app</code></td><td>绝对路径，从根目录开始</td><td>位置固定</td></tr>
          <tr><td><code>logs/app.log</code></td><td>相对路径，从当前目录开始</td><td>依赖当前位置</td></tr>
        </tbody>
      </table>
      <p>遇到陌生命令先看帮助：</p>
      <pre><code>命令 --help
man 命令

ls --help
man systemctl</code></pre>

      <h2 id="linux-navigation" data-toc="目录与文件">目录与文件操作</h2>
      <table>
        <thead><tr><th>命令</th><th>作用</th><th>常用示例</th></tr></thead>
        <tbody>
          <tr><td><code>pwd</code></td><td>显示当前目录</td><td><code>pwd</code></td></tr>
          <tr><td><code>ls</code></td><td>列出目录内容</td><td><code>ls -lah</code></td></tr>
          <tr><td><code>cd</code></td><td>切换目录</td><td><code>cd /opt/app</code></td></tr>
          <tr><td><code>mkdir</code></td><td>创建目录</td><td><code>mkdir -p app/logs</code></td></tr>
          <tr><td><code>touch</code></td><td>创建空文件或更新时间</td><td><code>touch app.log</code></td></tr>
          <tr><td><code>cp</code></td><td>复制文件或目录</td><td><code>cp -r config config.bak</code></td></tr>
          <tr><td><code>mv</code></td><td>移动或重命名</td><td><code>mv old.jar app.jar</code></td></tr>
          <tr><td><code>rm</code></td><td>删除文件或目录</td><td><code>rm -i old.log</code></td></tr>
          <tr><td><code>ln -s</code></td><td>创建软链接</td><td><code>ln -s /opt/app/releases/v2 current</code></td></tr>
        </tbody>
      </table>
      <blockquote>
        <p><code>rm</code> 默认不经过回收站。使用 <code>rm -rf</code> 前先执行 <code>pwd</code> 和 <code>ls</code> 确认位置；不要对不确定的路径、变量或通配符直接递归删除。</p>
      </blockquote>

      <h2 id="linux-read-search" data-toc="查看与搜索">查看文件和搜索内容</h2>
      <pre><code># 小文件：一次输出全部内容
cat application.yml

# 大文件：分页阅读，按 q 退出，输入 /关键词 搜索
less app.log

# 查看开头或末尾
head -n 20 app.log
tail -n 100 app.log

# 持续追踪新增日志，Ctrl+C 结束
tail -f app.log
tail -n 200 -f app.log</code></pre>
      <p><code>grep</code> 搜内容，<code>find</code> 找文件：</p>
      <pre><code># 显示行号、忽略大小写、递归搜索
grep -Rni "exception" logs/

# 只筛选包含 ERROR 的日志行
grep -n "ERROR" app.log

# 按名称寻找文件
find /opt/app -type f -name "*.jar"

# 找 7 天内修改过的日志
find /var/log -type f -name "*.log" -mtime -7</code></pre>

      <h2 id="linux-pipe-redirect" data-toc="管道与重定向">管道与重定向</h2>
      <p>管道 <code>|</code> 把左边命令的输出交给右边继续处理，是 Linux 最重要的组合能力。</p>
      <pre><code># 找出 Java 进程
ps aux | grep java

# 查看最近 200 行日志，再筛选异常
tail -n 200 app.log | grep "ERROR"

# 统计日志中 ERROR 出现次数
grep -c "ERROR" app.log</code></pre>
      <table>
        <thead><tr><th>符号</th><th>作用</th><th>示例</th></tr></thead>
        <tbody>
          <tr><td><code>&gt;</code></td><td>覆盖写入文件</td><td><code>echo hello &gt; test.txt</code></td></tr>
          <tr><td><code>&gt;&gt;</code></td><td>追加写入文件</td><td><code>echo hello &gt;&gt; test.txt</code></td></tr>
          <tr><td><code>2&gt;</code></td><td>重定向错误输出</td><td><code>command 2&gt; error.log</code></td></tr>
          <tr><td><code>2&gt;&amp;1</code></td><td>把错误输出合并到标准输出</td><td><code>command &gt; all.log 2&gt;&amp;1</code></td></tr>
          <tr><td><code>tee</code></td><td>同时显示并写入文件</td><td><code>command | tee output.log</code></td></tr>
        </tbody>
      </table>

      <h2 id="linux-permissions" data-toc="用户与权限">用户与文件权限</h2>
      <pre><code>ls -l
-rwxr-xr-- 1 app app 1024 Oct 12 deploy.sh</code></pre>
      <p>权限按「文件所有者、所属组、其他用户」分成三组；<code>r</code> 是读，<code>w</code> 是写，<code>x</code> 是执行。</p>
      <pre><code># 给当前所有者增加执行权限
chmod u+x deploy.sh

# 所有者 rwx，组和其他用户 r-x
chmod 755 deploy.sh

# 修改所有者和所属组
sudo chown -R app:app /opt/app

# 查看当前用户和所属组
whoami
id</code></pre>
      <p><code>sudo</code> 表示以更高权限执行当前命令，不是“命令报错就加 sudo”。避免使用 <code>chmod 777</code> 掩盖权限设计问题。</p>

      <h2 id="linux-process" data-toc="进程管理">进程与后台任务</h2>
      <pre><code># 查看进程
ps aux
pgrep -af java
top

# 正常请求进程退出，优先使用
kill -15 PID

# 进程无法正常退出时最后再用
kill -9 PID

# 后台启动 Jar，并把输出写入日志
nohup java -jar app.jar &gt; app.log 2&gt;&amp;1 &amp;

# 查看当前终端启动的后台任务
jobs
fg %1
bg %1</code></pre>
      <blockquote>
        <p><code>kill</code> 的本质是向进程发送信号。默认的 <code>kill PID</code> 等同于 <code>kill -15 PID</code>，允许程序执行清理；<code>-9</code> 会立即强制终止，应作为最后手段。</p>
      </blockquote>

      <h2 id="linux-systemd" data-toc="服务与日志">systemd 服务与系统日志</h2>
      <p>正式服务器通常用 systemd 管理应用，不建议长期依赖手动执行 <code>nohup</code>。</p>
      <pre><code># 查看、启动、停止、重启服务
sudo systemctl status myapp
sudo systemctl start myapp
sudo systemctl stop myapp
sudo systemctl restart myapp

# 设置开机启动
sudo systemctl enable myapp

# 持续查看某个服务的日志
journalctl -u myapp -f

# 查看最近一小时的日志
journalctl -u myapp --since "1 hour ago"

# 修改 service 文件后重新加载配置
sudo systemctl daemon-reload</code></pre>
      <p>排查服务时先看 <code>status</code>，再看 <code>journalctl</code>，通常能找到启动命令、权限、端口冲突或配置错误。</p>

      <h2 id="linux-network" data-toc="网络与端口">网络与端口排查</h2>
      <pre><code># 查看网卡地址和路由
ip addr
ip route

# 查看正在监听的 TCP 端口及进程
ss -lntp

# 测试网络连通性和域名解析
ping example.com
getent hosts example.com

# 调用接口；-I 只看响应头，-v 显示详细过程
curl http://localhost:8080/actuator/health
curl -I https://example.com
curl -v http://localhost:8080/api/users

# 下载文件
wget https://example.com/app.jar</code></pre>
      <p>后端服务访问失败时按顺序判断：进程是否存在 → 端口是否监听 → 本机请求是否成功 → 防火墙或安全组是否放行 → 域名和反向代理是否正确。</p>

      <h2 id="linux-resources" data-toc="资源与磁盘">磁盘、内存和系统负载</h2>
      <pre><code># 文件系统剩余空间
df -h

# 目录占用空间
du -sh /var/log
du -sh * | sort -h

# 内存使用情况
free -h

# 系统运行时间和平均负载
uptime

# 实时查看 CPU、内存和进程
top</code></pre>
      <p><code>df</code> 看整个分区还剩多少空间，<code>du</code> 看具体目录或文件占了多少空间。服务器磁盘告警时，两者通常要配合使用。</p>

      <h2 id="linux-archive-package" data-toc="压缩与软件安装">压缩、解压和软件安装</h2>
      <pre><code># tar.gz 打包与解压
tar -czf backup.tar.gz app/
tar -xzf backup.tar.gz

# 查看压缩包内容但不解压
tar -tzf backup.tar.gz

# zip 打包与解压
zip -r backup.zip app/
unzip backup.zip</code></pre>
      <p>常见发行版使用不同的软件包管理器：</p>
      <pre><code># Ubuntu / Debian
sudo apt update
sudo apt install nginx

# Fedora / 新版 CentOS、RHEL 系列
sudo dnf install nginx

# 较旧的 CentOS
sudo yum install nginx</code></pre>

      <h2 id="linux-remote" data-toc="SSH 与文件传输">SSH 登录与远程传输</h2>
      <pre><code># 登录远程服务器
ssh user@192.168.1.10
ssh -p 2222 user@192.168.1.10

# 上传文件或目录
scp app.jar user@192.168.1.10:/opt/app/
scp -r dist/ user@192.168.1.10:/opt/app/

# 增量同步目录；结尾的 / 会影响目录层级
rsync -avz --progress dist/ user@192.168.1.10:/opt/app/dist/</code></pre>
      <p>生产环境优先使用 SSH 密钥登录，不要把密码或私钥写进代码仓库。使用 <code>rsync --delete</code> 前先加 <code>--dry-run</code> 检查将要删除的文件。</p>

      <h2 id="linux-env" data-toc="环境变量">环境变量与 Shell</h2>
      <pre><code># 查看环境变量
env
printenv JAVA_HOME
echo $PATH

# 只在当前 Shell 及其子进程中生效
export APP_ENV=prod

# 重新加载当前 Shell 配置
source ~/.bashrc

# 查看命令历史
history</code></pre>
      <p>环境变量是否生效与“在哪个用户、哪个 Shell、哪个服务进程中设置”有关。终端里能看到的变量，不代表 systemd 启动的应用也能自动读到。</p>

      <h2 id="linux-backend-flow" data-toc="后端排查流程">后端部署与故障排查流程</h2>
      <p>部署 Spring Boot 应用时，可以按这条链路检查：</p>
      <pre class="flow">登录服务器
  ↓
确认目录和磁盘空间
  ↓
上传新 Jar / 配置文件
  ↓
检查文件所有者和权限
  ↓
重启 systemd 服务
  ↓
查看服务状态和启动日志
  ↓
检查 8080 等端口是否监听
  ↓
curl 本机健康检查接口
  ↓
再检查 Nginx、域名、防火墙和外部访问</pre>
      <pre><code>ssh app@server
cd /opt/myapp
pwd
df -h
ls -lah
sudo chown app:app app.jar
sudo systemctl restart myapp
sudo systemctl status myapp
journalctl -u myapp -n 100 --no-pager
ss -lntp | grep 8080
curl http://localhost:8080/actuator/health</code></pre>

      <h2 id="linux-cheatsheet" data-toc="最小必会清单">最小必会清单</h2>
      <p>刚开始不用一次背完所有参数，先做到以下命令能独立使用：</p>
      <pre><code>pwd  ls  cd  mkdir  touch  cp  mv  rm
cat  less  head  tail  grep  find
chmod  chown  sudo
ps  top  kill  systemctl  journalctl
ip  ss  ping  curl
df  du  free  tar
ssh  scp  rsync</code></pre>
      <blockquote>
        <p>最有效的练习方式是围绕真实问题使用命令：日志在哪里、哪个进程占端口、服务为什么没启动、磁盘被什么占满。能完成排查，比单纯背参数更重要。</p>
      </blockquote>
    `,
  },
  {
    id: "what-is-intellij-idea",
    category: "学习路线与工具",
    order: 30,
    title: "开发工具：IntelliJ IDEA 是什么",
    summary: "理解 IDEA、JDK、Maven 和 Spring Boot 各自负责什么",
    related: [
      "learning-path-crud-first",
      "springboot-fullstack-roadmap",
      "springboot-user-admin-crud",
    ],
    content: `
      <span class="article-tag">学习路线与工具 · 开发工具</span>
      <h1>开发工具：IntelliJ IDEA 是什么</h1>
      <p class="lead"><strong>IDEA</strong> 通常指 JetBrains 开发的 <strong>IntelliJ IDEA</strong>，它是一款集成开发环境（IDE），尤其适合编写 Java 和 Spring Boot 项目。</p>

      <h2 id="idea-definition" data-toc="IDEA 是什么">IDEA 本质上是什么</h2>
      <p>可以先把 IDEA 理解成一个功能很完整的“代码工作台”。它把编写、运行、调试和管理项目常用的工具集中在同一个界面里。</p>
      <pre class="flow">普通文本编辑器
主要负责写文字

IntelliJ IDEA
写代码 + 检查错误 + 运行项目 + 调试程序 + 管理依赖 + 操作 Git</pre>
      <p>IDE 是 <strong>Integrated Development Environment</strong> 的缩写，中文叫“集成开发环境”。IntelliJ 是产品系列名称，IDEA 是具体的 Java IDE 产品名称。</p>

      <h2 id="idea-features" data-toc="IDEA 能做什么">IDEA 能帮你做什么</h2>
      <ul>
        <li><strong>代码补全</strong>：输入一部分代码时提示类、方法和变量。</li>
        <li><strong>错误检查</strong>：在运行前标出语法错误、类型错误和部分潜在问题。</li>
        <li><strong>运行项目</strong>：直接启动普通 Java 程序或 Spring Boot 服务。</li>
        <li><strong>断点调试</strong>：暂停程序，逐行执行并查看变量值。</li>
        <li><strong>重构代码</strong>：安全地重命名类、方法和变量，提取方法等。</li>
        <li><strong>管理 Maven / Gradle</strong>：加载依赖、运行构建任务。</li>
        <li><strong>操作 Git</strong>：查看修改、提交代码、切换分支和解决冲突。</li>
        <li><strong>数据库与插件</strong>：连接数据库，安装 Lombok 等开发插件。</li>
      </ul>

      <h2 id="idea-toolchain" data-toc="和 JDK、Maven 的关系">IDEA、JDK、Maven 和 Spring Boot</h2>
      <p>它们不是同一种东西：</p>
      <table>
        <thead><tr><th>工具</th><th>负责什么</th><th>简单理解</th></tr></thead>
        <tbody>
          <tr><td>IntelliJ IDEA</td><td>编辑、运行和调试项目</td><td>开发工作台</td></tr>
          <tr><td>JDK</td><td>编译和运行 Java 程序</td><td>Java 的基础工具包</td></tr>
          <tr><td>Maven / Gradle</td><td>下载依赖、编译、测试和打包</td><td>项目构建工具</td></tr>
          <tr><td>Spring Boot</td><td>帮助开发 Java 后端应用</td><td>开发框架</td></tr>
        </tbody>
      </table>
      <pre class="flow">你在 IDEA 中写 Spring Boot 代码
        ↓
Maven 下载项目需要的依赖
        ↓
JDK 编译并运行 Java 程序
        ↓
Spring Boot 启动后端服务</pre>
      <blockquote>
        <p>没有 IDEA 也可以用命令行和其他编辑器开发 Java；但没有 JDK，Java 代码通常无法编译和运行。因此 IDEA 是开发工具，不是 Java 运行环境。</p>
      </blockquote>

      <h2 id="idea-editions" data-toc="社区版与旗舰版">Community 和 Ultimate 的区别</h2>
      <ul>
        <li><strong>Community Edition（社区版）</strong>：免费，适合 Java 基础、普通 Maven 项目和入门学习。</li>
        <li><strong>Ultimate Edition（旗舰版）</strong>：付费，对 Spring、数据库、Web 开发等提供更完整的内置支持。</li>
      </ul>
      <p>社区版仍然可以运行 Spring Boot 项目，只是缺少部分框架识别、导航和高级工具。学习 Java 基础时社区版通常够用；经常开发 Spring Boot 项目时旗舰版会更方便。</p>

      <h2 id="idea-first-use" data-toc="第一次使用">第一次使用先确认什么</h2>
      <ol>
        <li>安装与项目要求匹配的 JDK，例如 JDK 17 或 JDK 21。</li>
        <li>在 IDEA 的 Project SDK 中选择正确的 JDK。</li>
        <li>使用 Maven 或 Gradle 正确导入项目。</li>
        <li>找到带 <code>main</code> 方法的类，或 Spring Boot 的启动类。</li>
        <li>点击运行按钮启动，出错时先阅读控制台日志。</li>
      </ol>
      <pre><code>@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}</code></pre>
      <p>看到类似 <code>Started Application</code> 的日志，一般表示 Spring Boot 已成功启动。之后再根据日志中的端口访问服务，例如 <code>http://localhost:8080</code>。</p>

      <h2 id="idea-shortcuts" data-toc="常用快捷键">Windows 常用快捷键与缩写</h2>
      <table>
        <thead><tr><th>操作</th><th>快捷键 / 缩写</th></tr></thead>
        <tbody>
          <tr><td>基础代码补全</td><td><code>Ctrl + Space</code></td></tr>
          <tr><td>显示修复建议、导入类</td><td><code>Alt + Enter</code></td></tr>
          <tr><td>注释或取消注释当前行</td><td><code>Ctrl + /</code></td></tr>
          <tr><td>生成 <code>main</code> 方法</td><td>输入 <code>psvm</code> 后确认</td></tr>
          <tr><td>生成 <code>System.out.println()</code></td><td>输入 <code>sout</code> 后确认</td></tr>
        </tbody>
      </table>
      <p>快捷键可能受 IDEA 键位方案、操作系统和输入法影响。忘记快捷键时可使用 <code>Ctrl + Shift + A</code> 搜索 IDEA 中的操作名称。</p>

      <blockquote>
        <p><strong>一句话记忆：</strong>IntelliJ IDEA 是用来编写、运行和调试 Java 项目的开发工具；JDK 才是编译和运行 Java 的基础。</p>
      </blockquote>
    `,
  },
  {
    id: "learning-path-crud-first",
    category: "学习路线与工具",
    order: 10,
    title: "Java 后端学习路线：先掌握 CRUD",
    summary: "从 Java、MySQL 到 Spring Boot 项目的阶段式学习顺序",
    related: [
      "springboot-fullstack-roadmap",
      "java-object-create-dto",
      "java-spring-annotations",
      "java-object-json-serialize",
      "linux-common-commands",
      "what-is-intellij-idea",
      "springboot-user-admin-crud",
    ],
    content: `
      <span class="article-tag">学习路线与工具</span>
      <h1>Java 后端学习路线：先掌握 CRUD</h1>
      <p class="lead">你现在的问题往往不是「不懂高级知识」，反而是<strong>高级知识学得比基础代码能力快了</strong>。</p>

      <h2 id="gap" data-toc="知识结构缺口">知识结构缺口</h2>
      <p>你已经能讨论 Redis 原子性、MQ 削峰、幂等、事务、高并发；但如果要求：</p>
      <blockquote>
        <p>创建一个 User 表，实现新增、查询、修改、删除用户。</p>
      </blockquote>
      <p>写不出来，说明结构更像这样：</p>
      <pre class="flow">高级架构知识
     ↑
     |
基础 CRUD  ← 缺口
     |
Java 语法</pre>
      <p>合格 Java 后端更合理的顺序：</p>
      <pre class="flow">Java基础
 ↓
面向对象
 ↓
集合
 ↓
MySQL基础
 ↓
CRUD
 ↓
Spring Boot
 ↓
MyBatis
 ↓
项目分层
 ↓
Redis / MQ / JVM / 并发
 ↓
架构设计</pre>
      <blockquote>
        <p>现在不要继续钻秒杀、高并发。下一步是补齐基本功，独立写出完整 CRUD。</p>
      </blockquote>

      <h2 id="stage1" data-toc="阶段1：Java 基本功">第一阶段：Java 后端基本功（约 2~4 周）</h2>
      <p>目标：独立写出一个完整 CRUD 项目。</p>

      <h3>类和对象（必须熟练）</h3>
      <pre><code>public class User {
    private Long id;
    private String username;
}

User user = new User();
user.setUsername("张三");
user.getUsername();</code></pre>
      <p class="jump-row">
        <button class="jump-link" type="button" data-id="java-object-create-dto">相关：对象的创建与 DTO →</button>
      </p>

      <h3>集合（后端天天用）</h3>
      <ul>
        <li><code>List&lt;User&gt;</code>：一组数据；<code>select * from user</code> 常返回 List</li>
        <li><code>Map&lt;String, Object&gt;</code>：键值结构，接近 JSON 对象</li>
      </ul>
      <p>HashMap 底层先不用深挖，知道 key → hash → 数组位置 → value 即可。</p>

      <h3>异常</h3>
      <pre><code>try {
} catch (Exception e) {
}
throw new RuntimeException();</code></pre>
      <p>后端大量场景：参数错误、数据库异常、业务异常。</p>

      <h2 id="stage2" data-toc="阶段2：MySQL">第二阶段：MySQL 基础（必须）</h2>
      <p>不会 SQL 就写不了后端。至少会：建表、查、增、改、删，并达到「看见业务需求，可以设计表」。</p>
      <pre><code>CREATE TABLE user(
  id bigint,
  username varchar(50)
);

select * from user;
insert into user(...) values(...);
update user set username='张三' where id=1;
delete from user where id=1;</code></pre>

      <h2 id="stage3" data-toc="阶段3：Spring Boot CRUD">第三阶段：Spring Boot CRUD（当前重点）</h2>
      <p>例如用户管理系统。表字段：id / username / password / age。完整写出 Entity → Mapper → Service → Controller。</p>
      <pre><code>@Data
public class User {
    private Long id;
    private String username;
    private Integer age;
}

@Mapper
public interface UserMapper {
    List&lt;User&gt; selectList();
}

@Service
public class UserService {
    public List&lt;User&gt; list() { }
}

@RestController
@RequestMapping("/user")
public class UserController {
    @GetMapping("/list")
    public List&lt;User&gt; list() { }
}</code></pre>
      <p>当你能自己完成：查询列表、新增、修改、删除——后端基础才算入门。</p>
      <p class="jump-row">
        <button class="jump-link" type="button" data-id="springboot-fullstack-roadmap">实战路线：从 0 到 1 项目 →</button>
        <button class="jump-link" type="button" data-id="java-spring-annotations">相关：Spring Boot 常用注解 →</button>
      </p>

      <h2 id="stage4" data-toc="阶段4：理解 Spring">第四阶段：理解 Spring 为什么这样写</h2>
      <p>不要死记 <code>@Service</code> / <code>@Autowired</code> / <code>@RestController</code>，理解启动过程：</p>
      <pre class="flow">扫描注解
 ↓
创建对象
 ↓
放入 IOC 容器
 ↓
需要时注入</pre>
      <p>拦截器、ThreadLocal 等都建立在这个基础上。</p>

      <h2 id="stage5" data-toc="阶段5：真实项目">第五阶段：做一个真实项目</h2>
      <p>不要只做过于简单的「学生管理系统」。建议 ALMS 简化版——实验室设备管理：</p>
      <pre class="flow">用户：登录 / 查询 / 修改
设备：新增 / 查询 / 改状态 / 删除
预约：预约 / 取消 / 查记录</pre>
      <p>你会自然遇到：DTO、VO、Entity、Token、权限、Redis、定时任务。</p>

      <h2 id="months" data-toc="按月建议">按月建议</h2>
      <table>
        <thead>
          <tr><th>阶段</th><th>学什么</th><th>目标</th></tr>
        </thead>
        <tbody>
          <tr><td>第 1 个月</td><td>Java 基础 + Spring Boot CRUD + MySQL</td><td>能写后台接口</td></tr>
          <tr><td>第 2 个月</td><td>Spring MVC、MyBatis、Redis、JWT、异常、校验、日志</td><td>像普通开发</td></tr>
          <tr><td>第 3 个月</td><td>JVM、线程、锁、MQ、缓存、分布式、性能</td><td>高级开发</td></tr>
        </tbody>
      </table>

      <h2 id="avoid" data-toc="先别急着学">现在不要急着学</h2>
      <ul>
        <li>微服务</li>
        <li>分布式事务</li>
        <li>秒杀架构（可当拓展阅读，不当主线）</li>
        <li>JVM / Netty 源码</li>
      </ul>
      <blockquote>
        <p>现在像「已经知道发动机原理，但还不会开车」。先把车开起来。</p>
      </blockquote>

      <h2 id="next" data-toc="下一步行动">下一步行动</h2>
      <p>从一个真实 Spring Boot 项目开始写 CRUD，顺序建议：</p>
      <ol>
        <li>创建 Spring Boot 项目</li>
        <li>配置 Maven</li>
        <li>连接 MySQL</li>
        <li>创建 User 表</li>
        <li>Entity → Mapper → Service → Controller</li>
        <li>前端 Vue 调接口</li>
      </ol>
      <p>每写一步搞清：为什么这样设计、Spring 底层做了什么、面试怎么答、项目注意什么。</p>
      <blockquote>
        <p>现在缺的不是继续听概念，而是<strong>把一条完整请求链路亲手写出来</strong>。</p>
      </blockquote>
    `,
  },
];
