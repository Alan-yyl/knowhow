# SpringBoot Redis应用场景与最佳实践

## 前言

在前面的系列文章中，我们已经深入探讨了SpringBoot自动配置机制、Redis自动配置原理、Redis配置属性与客户端选择，以及Redis核心组件与API操作。本篇文章将聚焦于Redis在实际业务场景中的应用，为开发者提供针对常见业务问题的最佳实践方案，从而充分发挥Redis的价值。

## 1. Redis缓存实现与@Cacheable注解

### 1.1 Spring缓存抽象介绍

Spring提供了优秀的缓存抽象，通过简单的注解即可实现复杂的缓存逻辑，而Redis作为其后端存储的实现，可以提供高性能、可扩展的分布式缓存方案。

首先，需要在SpringBoot项目中引入相关依赖：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-cache</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

### 1.2 基础缓存配置

```java
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
        RedisCacheConfiguration cacheConfiguration = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofMinutes(10))  // 设置缓存过期时间为10分钟
                .disableCachingNullValues()  // 禁止缓存空值
                .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer()));
                
        return RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(cacheConfiguration)
                .build();
    }
}
```

### 1.3 使用@Cacheable注解缓存数据

```java
@Service
public class UserService {

    private final UserRepository userRepository;
    
    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Cacheable(value = "users", key = "#id", unless = "#result == null")
    public User getUserById(Long id) {
        System.out.println("从数据库获取用户: " + id);
        return userRepository.findById(id).orElse(null);
    }
    
    @CachePut(value = "users", key = "#user.id")
    public User updateUser(User user) {
        System.out.println("更新用户信息: " + user.getId());
        return userRepository.save(user);
    }
    
    @CacheEvict(value = "users", key = "#id")
    public void deleteUser(Long id) {
        System.out.println("删除用户: " + id);
        userRepository.deleteById(id);
    }
    
    @CacheEvict(value = "users", allEntries = true)
    public void clearUserCache() {
        System.out.println("清空用户缓存");
        // 方法体可以为空，注解会自动清除缓存
    }
}
```
```
### 1.4 自定义缓存管理器支持多缓存配置

```java
@Bean
public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
    // 创建不同的缓存配置
    Map<String, RedisCacheConfiguration> cacheConfigurations = new HashMap<>();
    
    // 用户缓存配置：过期时间30分钟
    cacheConfigurations.put("users", RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(30))
            .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer())));
    
    // 产品缓存配置：过期时间2小时
    cacheConfigurations.put("products", RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofHours(2))
            .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer())));
    
    // 默认缓存配置：过期时间10分钟
    RedisCacheConfiguration defaultCacheConfig = RedisCacheConfiguration.defaultCacheConfig()
            .entryTtl(Duration.ofMinutes(10))
            .disableCachingNullValues()
            .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer()));
    
    return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(defaultCacheConfig)
            .withInitialCacheConfigurations(cacheConfigurations)
            .build();
}
```

### 1.5 缓存注解的高级用法

```java
// 使用SpEL表达式动态生成key
@Cacheable(value = "users", key = "#user.id + '_' + #user.role")
public User getUserByIdAndRole(User user) {
    return userRepository.findByIdAndRole(user.getId(), user.getRole());
}

// 根据条件决定是否缓存
@Cacheable(value = "users", condition = "#user.age > 18", unless = "#result == null")
public User getAdultUser(User user) {
    return userRepository.findById(user.getId()).orElse(null);
}

// 组合使用多个缓存注解
@Caching(
    cacheable = @Cacheable(value = "users", key = "#username"),
    put = {
        @CachePut(value = "users", key = "#result.id", condition = "#result != null"),
        @CachePut(value = "usersByEmail", key = "#result.email", condition = "#result != null")
    }
)
public User getUserByUsername(String username) {
    return userRepository.findByUsername(username);
}
```

### 1.6 缓存穿透、缓存击穿与缓存雪崩的防范

#### 缓存穿透防范

缓存穿透是指查询一个不存在的数据，由于缓存不命中，导致大量请求直接落到数据库上。

```java
@Cacheable(value = "users", key = "#id", unless = "false") // 即使返回null也缓存
public User getUserById(Long id) {
    User user = userRepository.findById(id).orElse(null);
    // 如果查询结果为null，也放入缓存，设置较短的过期时间
    return user;
}

// 布隆过滤器实现
@Bean
public BloomFilter<String> userIdBloomFilter() {
    return BloomFilter.create(Funnels.stringFunnel(Charset.defaultCharset()), 1000000, 0.01);
}

@Cacheable(value = "users", key = "#id", condition = "@userIdBloomFilter.mightContain(#id.toString())")
public User getUserById(Long id) {
    return userRepository.findById(id).orElse(null);
}
```

#### 缓存击穿防范

缓存击穿是指热点key过期的瞬间，大量请求直接落到数据库上。

```java
// 使用互斥锁防止缓存击穿
public User getUserById(Long id) {
    String key = "user:" + id;
    User user = redisTemplate.opsForValue().get(key);
    
    if (user == null) {
        String lockKey = "lock:user:" + id;
        Boolean locked = redisTemplate.opsForValue().setIfAbsent(lockKey, "1", 10, TimeUnit.SECONDS);
        
        if (locked != null && locked) {
            try {
                // 双重检查，防止其他线程已经加载过数据
                user = redisTemplate.opsForValue().get(key);
                if (user == null) {
                    user = userRepository.findById(id).orElse(null);
                    if (user != null) {
                        redisTemplate.opsForValue().set(key, user, 1, TimeUnit.HOURS);
                    } else {
                        // 对于不存在的数据，设置短期缓存
                        redisTemplate.opsForValue().set(key, new NullValue(), 1, TimeUnit.MINUTES);
                    }
                }
            } finally {
                redisTemplate.delete(lockKey);
            }
        } else {
            // 未获取锁，短暂休眠后重试
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return getUserById(id);
        }
    }
    
    return user;
}
```

#### 缓存雪崩防范

缓存雪崩是指大量缓存同时过期，导致大量请求直接落到数据库上。

```java
// 设置随机过期时间
@Bean
public RedisCacheManager cacheManager(RedisConnectionFactory connectionFactory) {
    RedisCacheConfiguration cacheConfiguration = RedisCacheConfiguration.defaultCacheConfig()
            // 设置基础过期时间为9分钟，再加上随机的0-3分钟
            .entryTtl(Duration.ofMinutes(9 + new Random().nextInt(4)))
            .disableCachingNullValues()
            .serializeKeysWith(RedisSerializationContext.SerializationPair.fromSerializer(new StringRedisSerializer()))
            .serializeValuesWith(RedisSerializationContext.SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer()));
                
    return RedisCacheManager.builder(connectionFactory)
            .cacheDefaults(cacheConfiguration)
            .build();
}
```

## 2. 分布式锁实现与优化

### 2.1 基础分布式锁实现

```java
public class RedisLock {
    
    private final StringRedisTemplate redisTemplate;
    private final String lockKey;
    private final String lockValue;
    private final long expireTime;
    
    public RedisLock(StringRedisTemplate redisTemplate, String lockKey, long expireTime) {
        this.redisTemplate = redisTemplate;
        this.lockKey = lockKey;
        this.lockValue = UUID.randomUUID().toString();
        this.expireTime = expireTime;
    }
    
    /**
     * 获取锁
     */
    public boolean tryLock() {
        return Boolean.TRUE.equals(redisTemplate.opsForValue()
                .setIfAbsent(lockKey, lockValue, expireTime, TimeUnit.MILLISECONDS));
    }
    
    /**
     * 释放锁
     */
    public boolean releaseLock() {
        // 使用Lua脚本保证原子性操作
        String script = "if redis.call('get', KEYS[1]) == ARGV[1] then " +
                        "return redis.call('del', KEYS[1]) " +
                        "else " +
                        "return 0 " +
                        "end";
        
        Long result = redisTemplate.execute(new DefaultRedisScript<>(script, Long.class), 
                Collections.singletonList(lockKey), lockValue);
        
        return result != null && result == 1;
    }
}
```
### 2.2 使用Redisson实现更强大的分布式锁

```java
@Configuration
public class RedissonConfig {
    
    @Bean
    public RedissonClient redissonClient(RedisProperties redisProperties) {
        Config config = new Config();
        String redisUrl = String.format("redis://%s:%d", 
                redisProperties.getHost(), redisProperties.getPort());
        
        config.useSingleServer()
                .setAddress(redisUrl)
                .setPassword(redisProperties.getPassword())
                .setDatabase(redisProperties.getDatabase());
        
        return Redisson.create(config);
    }
}
```

使用Redisson实现分布式锁：

```java
@Service
public class OrderService {
    
    private final RedissonClient redissonClient;
    private final OrderRepository orderRepository;
    
    public OrderService(RedissonClient redissonClient, OrderRepository orderRepository) {
        this.redissonClient = redissonClient;
        this.orderRepository = orderRepository;
    }
    
    public boolean createOrder(Order order) {
        // 商品库存锁
        RLock lock = redissonClient.getLock("product_stock:" + order.getProductId());
        
        try {
            // 尝试获取锁，等待5秒，锁过期时间为30秒
            if (lock.tryLock(5, 30, TimeUnit.SECONDS)) {
                try {
                    // 检查库存
                    Product product = checkAndUpdateStock(order.getProductId(), order.getQuantity());
                    if (product != null) {
                        // 创建订单
                        order.setCreateTime(new Date());
                        orderRepository.save(order);
                        return true;
                    }
                    return false;
                } finally {
                    lock.unlock();
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        return false;
    }
    
    private Product checkAndUpdateStock(Long productId, int quantity) {
        // 业务逻辑：检查并更新库存
        return null;
    }
}
```

### 2.3 分布式可重入锁

Redisson提供了分布式环境下的可重入锁功能：

```java
@Service
public class InventoryService {
    
    private final RedissonClient redissonClient;
    
    public InventoryService(RedissonClient redissonClient) {
        this.redissonClient = redissonClient;
    }
    
    public void processInventory(Long productId) {
        RLock lock = redissonClient.getLock("inventory:" + productId);
        
        try {
            lock.lock();
            // 执行库存处理逻辑
            updateInventory(productId);
            
            // 在获取锁的状态下，调用另一个需要同样锁的方法
            processInventoryDetails(productId);
            
        } finally {
            lock.unlock();
        }
    }
    
    private void processInventoryDetails(Long productId) {
        RLock lock = redissonClient.getLock("inventory:" + productId);
        
        try {
            // 因为是可重入锁，此处能再次获得锁
            lock.lock();
            // 执行库存详情处理逻辑
        } finally {
            lock.unlock();
        }
    }
    
    private void updateInventory(Long productId) {
        // 更新库存的具体逻辑
    }
}
```

### 2.4 分布式读写锁

```java
@Service
public class DocumentService {
    
    private final RedissonClient redissonClient;
    
    public DocumentService(RedissonClient redissonClient) {
        this.redissonClient = redissonClient;
    }
    
    public String readDocument(String documentId) {
        RReadWriteLock rwLock = redissonClient.getReadWriteLock("document:" + documentId);
        RLock readLock = rwLock.readLock();
        
        try {
            readLock.lock();
            // 多个读操作可以同时进行
            return getDocumentContent(documentId);
        } finally {
            readLock.unlock();
        }
    }
    
    public void updateDocument(String documentId, String content) {
        RReadWriteLock rwLock = redissonClient.getReadWriteLock("document:" + documentId);
        RLock writeLock = rwLock.writeLock();
        
        try {
            writeLock.lock();
            // 写操作独占，此时不允许其他读写操作
            saveDocumentContent(documentId, content);
        } finally {
            writeLock.unlock();
        }
    }
    
    private String getDocumentContent(String documentId) {
        // 获取文档内容的实现
        return "Document content";
    }
    
    private void saveDocumentContent(String documentId, String content) {
        // 保存文档内容的实现
    }
}
```

## 3. 限流器实现

### 3.1 简单计数器限流

```java
@Component
public class SimpleRateLimiter {
    
    private final RedisTemplate<String, Object> redisTemplate;
    
    public SimpleRateLimiter(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }
    
    /**
     * 尝试获取访问权限
     * @param key 限流标识
     * @param maxRequests 最大请求数
     * @param period 时间窗口（秒）
     * @return 是否允许访问
     */
    public boolean isAllowed(String key, int maxRequests, int period) {
        String countKey = "ratelimit:" + key;
        
        // 当前计数
        Long count = redisTemplate.opsForValue().increment(countKey, 1);
        
        if (count != null && count == 1) {
            // 设置过期时间
            redisTemplate.expire(countKey, period, TimeUnit.SECONDS);
        }
        
        return count != null && count <= maxRequests;
    }
}
```

### 3.2 滑动窗口限流（基于Redis Sorted Set）

```java
@Component
public class SlidingWindowRateLimiter {
    
    private final RedisTemplate<String, Object> redisTemplate;
    
    public SlidingWindowRateLimiter(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }
    
    /**
     * 检查是否允许访问
     * @param key 限流标识
     * @param maxRequests 最大请求数
     * @param windowSeconds 时间窗口（秒）
     * @return 是否允许访问
     */
    public boolean isAllowed(String key, int maxRequests, int windowSeconds) {
        String redisKey = "sliding_window:" + key;
        
        // 获取当前时间戳（毫秒）
        long now = System.currentTimeMillis();
        // 计算窗口的开始时间
        long windowStart = now - (windowSeconds * 1000);
        
        // 使用Redis的事务
        SessionCallback<Boolean> callback = new SessionCallback<Boolean>() {
            @SuppressWarnings("unchecked")
            @Override
            public Boolean execute(RedisOperations operations) throws DataAccessException {
                operations.multi();
                
                // 添加当前请求到有序集合
                operations.opsForZSet().add(redisKey, String.valueOf(now), now);
                
                // 移除窗口外的过期请求
                operations.opsForZSet().removeRangeByScore(redisKey, 0, windowStart);
                
                // 获取当前窗口内的请求数
                operations.opsForZSet().size(redisKey);
                
                // 设置过期时间
                operations.expire(redisKey, windowSeconds * 2, TimeUnit.SECONDS);
                
                List<Object> results = operations.exec();
                if (results == null || results.size() < 3) {
                    return false;
                }
                
                Long requestCount = (Long) results.get(2);
                
                return requestCount <= maxRequests;
            }
        };
        
        return Boolean.TRUE.equals(redisTemplate.execute(callback));
    }
}
```
### 3.3 令牌桶限流（使用Redisson）

```java
@Component
public class TokenBucketRateLimiter {
    
    private final RedissonClient redissonClient;
    
    public TokenBucketRateLimiter(RedissonClient redissonClient) {
        this.redissonClient = redissonClient;
    }
    
    /**
     * 初始化令牌桶
     * @param key 令牌桶标识
     * @param capacity 桶容量
     * @param rate 令牌生成速率(个/秒)
     */
    public void initBucket(String key, int capacity, int rate) {
        RRateLimiter limiter = redissonClient.getRateLimiter(key);
        limiter.trySetRate(RateType.OVERALL, rate, 1, RateIntervalUnit.SECONDS);
        // 添加初始令牌
        limiter.tryAcquire(0);
    }
    
    /**
     * 尝试获取令牌
     * @param key 令牌桶标识
     * @param tokens 需要获取的令牌数
     * @param timeout 超时时间(秒)，0表示不等待
     * @return 是否获取成功
     */
    public boolean tryAcquire(String key, int tokens, int timeout) {
        RRateLimiter limiter = redissonClient.getRateLimiter(key);
        try {
            return limiter.tryAcquire(tokens, timeout, TimeUnit.SECONDS);
        } catch (Exception e) {
            return false;
        }
    }
}
```

## 4. 计数器与排行榜

### 4.1 简单计数器实现

```java
@Component
public class RedisCounter {
    
    private final StringRedisTemplate redisTemplate;
    
    public RedisCounter(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }
    
    /**
     * 递增计数
     * @param key 计数器键
     * @param delta 增量值
     * @return 增加后的值
     */
    public Long increment(String key, long delta) {
        return redisTemplate.opsForValue().increment(key, delta);
    }
    
    /**
     * 递减计数
     * @param key 计数器键
     * @param delta 减量值
     * @return 减少后的值
     */
    public Long decrement(String key, long delta) {
        return redisTemplate.opsForValue().decrement(key, delta);
    }
    
    /**
     * 获取当前计数
     * @param key 计数器键
     * @return 当前计数值
     */
    public Long getCurrentValue(String key) {
        String value = redisTemplate.opsForValue().get(key);
        return value != null ? Long.parseLong(value) : 0L;
    }
    
    /**
     * 设置过期时间
     * @param key 计数器键
     * @param timeout 过期时间
     * @param unit 时间单位
     * @return 是否设置成功
     */
    public Boolean expire(String key, long timeout, TimeUnit unit) {
        return redisTemplate.expire(key, timeout, unit);
    }
    
    /**
     * 重置计数器
     * @param key 计数器键
     */
    public void reset(String key) {
        redisTemplate.delete(key);
    }
}
```

### 4.2 统计UV和PV

```java
@Component
public class PageViewCounter {
    
    private final StringRedisTemplate redisTemplate;
    
    public PageViewCounter(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }
    
    /**
     * 记录PV（Page View）
     * @param pageId 页面ID
     * @param date 日期，格式：yyyyMMdd
     * @return 当前PV值
     */
    public Long incrementPageView(String pageId, String date) {
        String key = String.format("pv:%s:%s", pageId, date);
        return redisTemplate.opsForValue().increment(key);
    }
    
    /**
     * 记录UV（Unique Visitor）
     * @param pageId 页面ID
     * @param date 日期，格式：yyyyMMdd
     * @param userId 用户标识
     * @return 当前UV值
     */
    public Long recordUniqueVisitor(String pageId, String date, String userId) {
        String key = String.format("uv:%s:%s", pageId, date);
        Boolean added = redisTemplate.opsForHyperLogLog().add(key, userId);
        
        // 获取UV数量
        return redisTemplate.opsForHyperLogLog().size(key);
    }
    
    /**
     * 获取指定日期范围内的PV总和
     * @param pageId 页面ID
     * @param startDate 开始日期，格式：yyyyMMdd
     * @param endDate 结束日期，格式：yyyyMMdd
     * @return PV总和
     */
    public Long getPageViewSum(String pageId, String startDate, String endDate) {
        LocalDate start = LocalDate.parse(startDate, DateTimeFormatter.ofPattern("yyyyMMdd"));
        LocalDate end = LocalDate.parse(endDate, DateTimeFormatter.ofPattern("yyyyMMdd"));
        
        Long sum = 0L;
        while (!start.isAfter(end)) {
            String date = start.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
            String key = String.format("pv:%s:%s", pageId, date);
            String value = redisTemplate.opsForValue().get(key);
            if (value != null) {
                sum += Long.parseLong(value);
            }
            start = start.plusDays(1);
        }
        
        return sum;
    }
    
    /**
     * 合并多个日期的UV
     * @param pageId 页面ID
     * @param startDate 开始日期，格式：yyyyMMdd
     * @param endDate 结束日期，格式：yyyyMMdd
     * @return 合并后的UV数量
     */
    public Long mergeUniqueVisitors(String pageId, String startDate, String endDate) {
        LocalDate start = LocalDate.parse(startDate, DateTimeFormatter.ofPattern("yyyyMMdd"));
        LocalDate end = LocalDate.parse(endDate, DateTimeFormatter.ofPattern("yyyyMMdd"));
        
        List<String> keys = new ArrayList<>();
        while (!start.isAfter(end)) {
            String date = start.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
            keys.add(String.format("uv:%s:%s", pageId, date));
            start = start.plusDays(1);
        }
        
        if (keys.isEmpty()) {
            return 0L;
        }
        
        String mergeKey = String.format("uv:%s:%s_%s", pageId, startDate, endDate);
        redisTemplate.opsForHyperLogLog().union(mergeKey, 
                keys.toArray(new String[0]));
        
        return redisTemplate.opsForHyperLogLog().size(mergeKey);
    }
}
```

### 4.3 实现排行榜

```java
@Component
public class RankingService {
    
    private final RedisTemplate<String, Object> redisTemplate;
    
    public RankingService(RedisTemplate<String, Object> redisTemplate) {
        this.redisTemplate = redisTemplate;
    }
    
    /**
     * 添加或更新分数
     * @param rankKey 排行榜键
     * @param member 成员
     * @param score 分数
     * @return 是否成功
     */
    public Boolean addScore(String rankKey, String member, double score) {
        return redisTemplate.opsForZSet().add(rankKey, member, score);
    }
    
    /**
     * 增加分数
     * @param rankKey 排行榜键
     * @param member 成员
     * @param delta 增量
     * @return 新的分数
     */
    public Double incrementScore(String rankKey, String member, double delta) {
        return redisTemplate.opsForZSet().incrementScore(rankKey, member, delta);
    }
    
    /**
     * 获取成员分数
     * @param rankKey 排行榜键
     * @param member 成员
     * @return 分数
     */
    public Double getScore(String rankKey, String member) {
        return redisTemplate.opsForZSet().score(rankKey, member);
    }
    
    /**
     * 获取成员排名(从0开始，升序)
     * @param rankKey 排行榜键
     * @param member 成员
     * @return 排名
     */
    public Long getRank(String rankKey, String member) {
        return redisTemplate.opsForZSet().rank(rankKey, member);
    }
    
    /**
     * 获取成员排名(从0开始，降序)
     * @param rankKey 排行榜键
     * @param member 成员
     * @return 排名
     */
    public Long getReverseRank(String rankKey, String member) {
        return redisTemplate.opsForZSet().reverseRank(rankKey, member);
    }
    
    /**
     * 获取排名范围内的成员(升序)
     * @param rankKey 排行榜键
     * @param start 开始位置
     * @param end 结束位置
     * @return 成员列表
     */
    public Set<Object> getRangeByRank(String rankKey, long start, long end) {
        return redisTemplate.opsForZSet().range(rankKey, start, end);
    }
    
    /**
     * 获取排名范围内的成员和分数(升序)
     * @param rankKey 排行榜键
     * @param start 开始位置
     * @param end 结束位置
     * @return 成员和分数
     */
    public Set<ZSetOperations.TypedTuple<Object>> getRangeByRankWithScores(String rankKey, long start, long end) {
        return redisTemplate.opsForZSet().rangeWithScores(rankKey, start, end);
    }
    
    /**
     * 获取排名范围内的成员(降序)
     * @param rankKey 排行榜键
     * @param start 开始位置
     * @param end 结束位置
     * @return 成员列表
     */
    public Set<Object> getReverseRangeByRank(String rankKey, long start, long end) {
        return redisTemplate.opsForZSet().reverseRange(rankKey, start, end);
    }
    
    /**
     * 获取排名范围内的成员和分数(降序)
     * @param rankKey 排行榜键
     * @param start 开始位置
     * @param end 结束位置
     * @return 成员和分数
     */
    public Set<ZSetOperations.TypedTuple<Object>> getReverseRangeByRankWithScores(String rankKey, long start, long end) {
        return redisTemplate.opsForZSet().reverseRangeWithScores(rankKey, start, end);
    }
    
    /**
     * 获取分数范围内的成员数量
     * @param rankKey 排行榜键
     * @param min 最小分数
     * @param max 最大分数
     * @return 成员数量
     */
    public Long countByScore(String rankKey, double min, double max) {
        return redisTemplate.opsForZSet().count(rankKey, min, max);
    }
    
    /**
     * 移除成员
     * @param rankKey 排行榜键
     * @param members 成员
     * @return 移除的成员数量
     */
    public Long removeMembers(String rankKey, Object... members) {
        return redisTemplate.opsForZSet().remove(rankKey, members);
    }
}
```
## 5. 消息队列与发布订阅

### 5.1 基于List实现简单消息队列

```java
@Component
public class RedisListQueue {
    
    private final StringRedisTemplate redisTemplate;
    
    public RedisListQueue(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }
    
    /**
     * 发送消息（生产者）
     * @param queueName 队列名称
     * @param message 消息内容
     * @return 队列长度
     */
    public Long sendMessage(String queueName, String message) {
        return redisTemplate.opsForList().rightPush(queueName, message);
    }
    
    /**
     * 批量发送消息
     * @param queueName 队列名称
     * @param messages 消息列表
     * @return 队列长度
     */
    public Long sendMessages(String queueName, List<String> messages) {
        return redisTemplate.opsForList().rightPushAll(queueName, messages);
    }
    
    /**
     * 接收消息（消费者，非阻塞）
     * @param queueName 队列名称
     * @return 消息内容，队列为空时返回null
     */
    public String receiveMessage(String queueName) {
        return redisTemplate.opsForList().leftPop(queueName);
    }
    
    /**
     * 接收消息（消费者，阻塞）
     * @param queueName 队列名称
     * @param timeout 超时时间
     * @param unit 时间单位
     * @return 消息内容，超时返回null
     */
    public String receiveMessageBlocking(String queueName, long timeout, TimeUnit unit) {
        return redisTemplate.opsForList().leftPop(queueName, timeout, unit);
    }
    
    /**
     * 查看队列中的消息，但不消费
     * @param queueName 队列名称
     * @param start 开始位置
     * @param end 结束位置
     * @return 消息列表
     */
    public List<String> peekMessages(String queueName, long start, long end) {
        return redisTemplate.opsForList().range(queueName, start, end);
    }
    
    /**
     * 获取队列长度
     * @param queueName 队列名称
     * @return 队列长度
     */
    public Long getQueueLength(String queueName) {
        return redisTemplate.opsForList().size(queueName);
    }
}
```

### 5.2 发布订阅模式

```java
@Component
public class RedisMessagePublisher {
    
    private final StringRedisTemplate redisTemplate;
    
    public RedisMessagePublisher(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
    }
    
    /**
     * 发布消息
     * @param channel 频道
     * @param message 消息内容
     */
    public void publish(String channel, String message) {
        redisTemplate.convertAndSend(channel, message);
    }
}
```

```java
@Component
public class RedisMessageListener {
    
    private final RedisMessageListenerContainer container;
    
    public RedisMessageListener(RedisConnectionFactory connectionFactory) {
        this.container = new RedisMessageListenerContainer();
        this.container.setConnectionFactory(connectionFactory);
        this.container.afterPropertiesSet();
        this.container.start();
    }
    
    /**
     * 订阅频道
     * @param channelPattern 频道模式
     * @param listener 监听器
     */
    public void subscribe(String channelPattern, MessageListener listener) {
        container.addMessageListener(listener, new PatternTopic(channelPattern));
    }
    
    /**
     * 取消订阅
     * @param listener 监听器
     */
    public void unsubscribe(MessageListener listener) {
        container.removeMessageListener(listener);
    }
    
    /**
     * 创建消息监听器
     * @param callback 回调函数
     * @return 监听器
     */
    public MessageListener createListener(Consumer<String> callback) {
        return (message, pattern) -> callback.accept(new String(message.getBody()));
    }
}
