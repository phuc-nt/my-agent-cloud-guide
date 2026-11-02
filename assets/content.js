// Content rendered into the decisions accordion, the lessons grid and the checklist.
window.GUIDE = {
  decisions: [
    {
      t: "Giữ engine, đặt nó vào container",
      s: "Không viết lại thành agent cloud-native.",
      why: "Engine đã có approval, memory, tool, scheduler và nhiều tháng sửa lỗi thật. Viết lại trên một SDK cloud sẽ mất tất cả những thứ đó và tạo ra hai codebase phải giữ đồng bộ.",
      cost: "Phải trả cold start khi container thức dậy, và phải dựng lớp sidecar để engine chạy được ở nơi disk không bền."
    },
    {
      t: "Một home, một container",
      s: "Mỗi home có đúng một instance.",
      why: "Engine giả định nó chạy một mình trên một máy: file lock, SQLite, hub sự kiện trong bộ nhớ. Giữ một container cho mỗi home thì các giả định đó vẫn đúng, không cần database dùng chung.",
      cost: "Không scale ngang. Với một người dùng thì đó không phải vấn đề."
    },
    {
      t: "Scheduler và Telegram ra Worker",
      s: "Thứ gì cần thức theo giờ thì không nằm trong container.",
      why: "Container chỉ ngủ được khi không có gì bên trong cần tự thức. Cron của Worker tính job đến hạn theo timezone của chủ, rồi đánh thức container và gọi API chạy job. Telegram chuyển từ long-poll sang webhook.",
      cost: "Engine cần chế độ --no-schedule và webhook, nên cả hai được làm như feature upstream."
    },
    {
      t: "R2 là nguồn sự thật",
      s: "Disk của container chỉ là cache.",
      why: "Container có thể bị thay bất cứ lúc nào. Snapshot home lên R2 khi có thay đổi và trước SIGTERM; manifest có generation nên bản cũ không đè được bản mới. Chỉ container ghi home.",
      cost: "Mỗi lần thức phải restore, góp vào cold start. Cần thêm backup hằng ngày (giữ 30 ngày) để quay lại được."
    },
    {
      t: "Engine changes go upstream",
      s: "Platform chỉ pin version.",
      why: "Không patch engine trong repo platform. Thiếu gì thì viết feature có test ở repo engine, phát hành, rồi bump version đã pin. Hai repo deploy độc lập, và engine vẫn chạy được trên laptop.",
      cost: "Một thay đổi nhỏ cũng phải qua hai bước: phát hành engine rồi mới bump ở platform."
    },
    {
      t: "Engine không bao giờ public",
      s: "Chỉ Durable Object gọi container.",
      why: "Mọi request vào container mang control key, và sidecar từ chối request thiếu key. Không có route nào từ Internet đi thẳng vào engine.",
      cost: "Mọi tính năng mới của web UI phải đi qua proxy của Worker."
    },
    {
      t: "Credential tiêm ở egress",
      s: "Token thật không nằm trong container.",
      why: "Agent có thể bị prompt injection. Nếu token không ở trong container thì không có gì để lấy cắp. Outbound handler thay token giả bằng token thật và chỉ cho qua danh sách method + path đã khai báo.",
      cost: "Mỗi API mới cần khai báo allowlist; request lạ bị chặn, kể cả request hợp lệ mà bạn quên khai báo."
    },
    {
      t: "Approval thuộc về engine",
      s: "Platform phản chiếu, không tự duyệt.",
      why: "Approval là một feature của sản phẩm, không phải bước thừa. Platform chỉ chuyển tiếp nút Duyệt từ Telegram, web và phone inbox về engine, không có công tắc bỏ qua.",
      cost: "Job chạy đêm có hành động ghi sẽ chờ tới khi bạn bấm. Lệnh đã quen thì đánh dấu trong shell_ask_patterns."
    },
    {
      t: "Dữ liệu cá nhân ở trong tài khoản",
      s: "Không thêm dịch vụ bên thứ ba.",
      why: "Dữ liệu chỉ nằm trong tài khoản cloud của chính mình và những nguồn đang dùng sẵn. Web Push chỉ mang payload rỗng: điện thoại được báo có việc, nội dung tải qua kênh đã đăng nhập.",
      cost: "Bỏ qua một số dịch vụ tiện lợi (log, analytics, OCR bên ngoài)."
    },
    {
      t: "Máy cá nhân là edge",
      s: "Poll ra ngoài, theo allowlist.",
      why: "Một số việc cần màn hình hoặc file trên máy. Edge poll Worker để lấy việc, không mở cổng, chỉ chạy loại task đã khai báo. Engine không bao giờ chạy song song ở hai nơi.",
      cost: "Việc cần máy thì chỉ chạy được khi máy bật; cookie do máy làm mới có thể cũ đi nếu máy tắt lâu, nên cần cảnh báo khi drop cũ."
    }
  ],

  lessons: [
    {
      t: "Deploy giết session đang chạy",
      sym: "Rollout thay container đang thức; turn đang chạy dở bị cắt ngang.",
      fix: "Cho home ngủ trước khi deploy, rồi mới rollout."
    },
    {
      t: "Một tab web mở giữ container thức",
      sym: "Web UI poll đều đặn, mỗi request reset đồng hồ 15 phút, nên container không bao giờ ngủ.",
      fix: "Những request nền của UI không được tính là hoạt động; chỉ request của người dùng mới giữ container thức."
    },
    {
      t: "Snapshot SQLite đổi byte dù dữ liệu không đổi",
      sym: "Backup API của SQLite ghi lại trang theo thứ tự khác, nên hash đổi và lần nào cũng đẩy lại.",
      fix: "So sánh theo .dump (nội dung logic), không theo byte của file."
    },
    {
      t: "Mang cookie, đừng mang profile trình duyệt",
      sym: "Profile Chromium mã hoá cookie bằng khoá của hệ điều hành; sang máy khác thì đọc không được. Đóng gói profile đang mở còn làm hỏng nó.",
      fix: "Export cookie dạng Playwright storage state rồi seed vào trình duyệt trong container."
    },
    {
      t: "Đường dẫn tuyệt đối theo tên máy",
      sym: "Script và config có đường dẫn /Users/<tên> chạy được trên laptop nhưng gãy trong container.",
      fix: "Dùng ~ hoặc đường dẫn tính từ vị trí file; image không cần biết tên người dùng."
    },
    {
      t: "Cấu hình sửa ở hai nơi",
      sym: "Sửa trên máy rồi đẩy lên có thể đè mất thay đổi agent vừa làm trên cloud.",
      fix: "Biến home thành git: update chỉ fast-forward, cloud tự commit, pull thì merge."
    },
    {
      t: "Callback Telegram cũ sau cold start",
      sym: "Bấm nút trong lúc container đang thức dậy; khi engine sẵn sàng thì callback đã quá hạn và answerCallbackQuery báo lỗi.",
      fix: "Worker trả lời callback ngay, phần còn lại xử lý sau; lỗi callback quá hạn được bỏ qua có chủ đích."
    },
    {
      t: "Cache 1h hay 5 phút",
      sym: "Agent dùng rải rác trong ngày: cache 5 phút hết hạn giữa hai câu hỏi, lượt nào cũng phải ghi lại prefix.",
      fix: "Cache 1h đắt hơn khi ghi nhưng rẻ hơn nhiều khi đọc; với nhịp dùng của một người, chi phí theo số lần quay lại sau hơn 1 giờ nghỉ."
    }
  ],

  checklist: [
    {
      t: "Chuẩn bị engine",
      items: [
        "Engine chạy được như một process, nghe ở localhost, cấu hình nằm trong một thư mục home",
        "Scheduler tắt được bằng cờ và có API để chạy một job theo id",
        "Kênh chat hỗ trợ webhook, không chỉ long-poll",
        "Approval lưu bền (SQLite) và resume được sau khi process khởi động lại",
        "Phát hành engine theo version để platform pin"
      ]
    },
    {
      t: "Dựng platform",
      items: [
        "Image: engine đã pin, sidecar đứng trước, shell chạy trong sandbox",
        "Sidecar: restore snapshot khi start, đẩy khi đổi và trước SIGTERM",
        "Durable Object cho mỗi home, control key cho mọi request",
        "Worker: proxy web UI sau lớp đăng nhập, webhook có secret token",
        "Cron mỗi phút tính job đến hạn và đánh thức container",
        "Egress allowlist; token nhạy cảm tiêm ở outbound handler"
      ]
    },
    {
      t: "Vận hành",
      items: [
        "Backup hằng ngày, thử restore từ một bản backup",
        "Cho home ngủ trước mỗi lần deploy",
        "Đo cold start, thời gian thức, chi phí từ số liệu thật",
        "Home là git: update chỉ fast-forward, pull có merge",
        "Edge chỉ poll ra ngoài; cảnh báo khi drop quá cũ",
        "Kiểm tra approval từ mọi kênh: chat, web, phone"
      ]
    }
  ]
};
