import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/en";
import "dayjs/locale/es";
import "dayjs/locale/fr";
import "dayjs/locale/ja";
import "dayjs/locale/ko";
import "dayjs/locale/zh-cn";

dayjs.extend(relativeTime);

export default dayjs;
