<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Doctor;
use App\Models\DoctorSchedule;
use App\Models\Hospital;
use App\Models\Subscription;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class HospitalSeeder extends Seeder
{
    public function run(): void
    {
        $subscription = Subscription::firstOrCreate(
            ['name' => 'Professional'],
            [
                'monthly_price' => 4999,
                'max_doctors' => 50,
                'max_calls_per_month' => 5000,
                'is_active' => true,
            ]
        );

        $hospitals = [
            [
                'name'    => 'ঢাকা মেডিকেল কলেজ হাসপাতাল',
                'slug'    => 'dhaka-medical',
                'address' => 'বকশীবাজার, ঢাকা-১০০০',
                'city'    => 'ঢাকা',
                'phone'   => '01700-000001',
            ],
            [
                'name'    => 'স্কয়ার হাসপাতাল',
                'slug'    => 'square-hospital',
                'address' => '১৮/এফ, পান্থপথ, ঢাকা-১২০৫',
                'city'    => 'ঢাকা',
                'phone'   => '01700-000002',
            ],
            [
                'name'    => 'চট্টগ্রাম মেডিকেল কলেজ হাসপাতাল',
                'slug'    => 'ctg-medical',
                'address' => 'কে.বি. ফজলুল কাদের রোড, চট্টগ্রাম',
                'city'    => 'চট্টগ্রাম',
                'phone'   => '01700-000003',
            ],
        ];

        $departmentNames = [
            'হৃদরোগ বিভাগ',
            'অর্থোপেডিক বিভাগ',
            'শিশু রোগ বিভাগ',
            'নাক-কান-গলা বিভাগ',
            'চর্মরোগ বিভাগ',
            'নিউরোলজি বিভাগ',
            'ডায়াবেটিস ও মেডিসিন বিভাগ',
            'গাইনি ও প্রসূতি বিভাগ',
        ];

        $hospitalIds = [];
        foreach ($hospitals as $data) {
            $hospital = Hospital::firstOrCreate(
                ['slug' => $data['slug']],
                array_merge($data, [
                    'country'         => 'BD',
                    'status'          => 'active',
                    'subscription_id' => $subscription->id,
                ])
            );
            $hospitalIds[$data['slug']] = $hospital->id;
            $this->command->info("Hospital: {$hospital->name} (id={$hospital->id})");
        }

        // Departments per hospital
        $deptIds = [];
        foreach ($hospitalIds as $slug => $hId) {
            foreach ($departmentNames as $deptName) {
                $dept = Department::firstOrCreate(
                ['hospital_id' => $hId, 'slug' => Str::slug($deptName)],
                ['name' => $deptName]
            );
                $deptIds[$hId][$deptName] = $dept->id;
            }
        }

        // Doctors — day_of_week: Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
        $doctors = [
            // ── ঢাকা মেডিকেল ─────────────────────────────────────────────────
            [
                'hospital_slug'   => 'dhaka-medical',
                'dept'            => 'হৃদরোগ বিভাগ',
                'name'            => 'মোহাম্মদ আনোয়ার হোসেন',
                'title'           => 'অধ্যাপক ডাঃ',
                'qualifications'  => 'এমবিবিএস, এফসিপিএস (কার্ডিওলজি), এমডি',
                'specializations' => 'হৃদরোগ, হার্ট অ্যাটাক, উচ্চ রক্তচাপ',
                'fee'             => 1200,
                'minutes'         => 20,
                'schedules'       => [[0, '09:00', '13:00', 20], [2, '09:00', '13:00', 20], [4, '09:00', '13:00', 20]],
            ],
            [
                'hospital_slug'   => 'dhaka-medical',
                'dept'            => 'অর্থোপেডিক বিভাগ',
                'name'            => 'ফারহানা বেগম',
                'title'           => 'ডাঃ',
                'qualifications'  => 'এমবিবিএস, এমএস (অর্থোপেডিক্স)',
                'specializations' => 'হাড়ের সমস্যা, জয়েন্ট ব্যথা, ফ্র্যাকচার',
                'fee'             => 800,
                'minutes'         => 15,
                'schedules'       => [[0, '14:00', '18:00', 25], [1, '14:00', '18:00', 25], [3, '14:00', '18:00', 25], [5, '10:00', '13:00', 20]],
            ],
            [
                'hospital_slug'   => 'dhaka-medical',
                'dept'            => 'শিশু রোগ বিভাগ',
                'name'            => 'রাহেলা খানম',
                'title'           => 'ডাঃ',
                'qualifications'  => 'এমবিবিএস, ডিসিএইচ, এফসিপিএস (শিশুরোগ)',
                'specializations' => 'শিশুরোগ, নবজাতক সমস্যা, টিকা পরামর্শ',
                'fee'             => 600,
                'minutes'         => 15,
                'schedules'       => [[0, '10:00', '14:00', 30], [2, '10:00', '14:00', 30], [4, '10:00', '14:00', 30]],
            ],
            [
                'hospital_slug'   => 'dhaka-medical',
                'dept'            => 'নিউরোলজি বিভাগ',
                'name'            => 'সিরাজুল ইসলাম',
                'title'           => 'অধ্যাপক ডাঃ',
                'qualifications'  => 'এমবিবিএস, এমডি (নিউরোলজি)',
                'specializations' => 'মস্তিষ্কের রোগ, স্ট্রোক, মাইগ্রেন, মৃগীরোগ',
                'fee'             => 1000,
                'minutes'         => 20,
                'schedules'       => [[1, '09:00', '13:00', 20], [3, '09:00', '13:00', 20], [5, '09:00', '12:00', 15]],
            ],
            // ── স্কয়ার হাসপাতাল ─────────────────────────────────────────────
            [
                'hospital_slug'   => 'square-hospital',
                'dept'            => 'হৃদরোগ বিভাগ',
                'name'            => 'তানভীর আহমেদ',
                'title'           => 'ডাঃ',
                'qualifications'  => 'এমবিবিএস, এফসিপিএস (কার্ডিওলজি)',
                'specializations' => 'ইন্টারভেনশনাল কার্ডিওলজি, অ্যাঞ্জিওপ্লাস্টি',
                'fee'             => 1500,
                'minutes'         => 20,
                'schedules'       => [[0, '16:00', '20:00', 20], [2, '16:00', '20:00', 20], [4, '16:00', '20:00', 20]],
            ],
            [
                'hospital_slug'   => 'square-hospital',
                'dept'            => 'ডায়াবেটিস ও মেডিসিন বিভাগ',
                'name'            => 'নাসরিন আক্তার',
                'title'           => 'ডাঃ',
                'qualifications'  => 'এমবিবিএস, এমডি (মেডিসিন)',
                'specializations' => 'ডায়াবেটিস, থাইরয়েড, উচ্চ রক্তচাপ, মেদবাহুল্য',
                'fee'             => 900,
                'minutes'         => 15,
                'schedules'       => [[1, '10:00', '14:00', 30], [3, '10:00', '14:00', 30], [5, '10:00', '13:00', 20], [6, '10:00', '13:00', 20]],
            ],
            [
                'hospital_slug'   => 'square-hospital',
                'dept'            => 'নাক-কান-গলা বিভাগ',
                'name'            => 'মাহবুব আলম',
                'title'           => 'ডাঃ',
                'qualifications'  => 'এমবিবিএস, এমএস (ইএনটি)',
                'specializations' => 'নাকের পলিপ, কানের সমস্যা, টনসিল, গলার রোগ',
                'fee'             => 700,
                'minutes'         => 12,
                'schedules'       => [[0, '17:00', '20:00', 25], [2, '17:00', '20:00', 25], [4, '17:00', '20:00', 25]],
            ],
            [
                'hospital_slug'   => 'square-hospital',
                'dept'            => 'গাইনি ও প্রসূতি বিভাগ',
                'name'            => 'শারমিন সুলতানা',
                'title'           => 'ডাঃ',
                'qualifications'  => 'এমবিবিএস, এফসিপিএস (গাইনি)',
                'specializations' => 'গর্ভকালীন সেবা, প্রসব, নারীরোগ',
                'fee'             => 1000,
                'minutes'         => 20,
                'schedules'       => [[1, '15:00', '19:00', 20], [3, '15:00', '19:00', 20], [5, '15:00', '18:00', 15]],
            ],
            // ── চট্টগ্রাম মেডিকেল ────────────────────────────────────────────
            [
                'hospital_slug'   => 'ctg-medical',
                'dept'            => 'চর্মরোগ বিভাগ',
                'name'            => 'করিম উদ্দিন',
                'title'           => 'ডাঃ',
                'qualifications'  => 'এমবিবিএস, ডিডিভি (চর্মরোগ)',
                'specializations' => 'চর্মরোগ, একজিমা, সোরিয়াসিস, ব্রণ',
                'fee'             => 600,
                'minutes'         => 10,
                'schedules'       => [[0, '09:00', '13:00', 40], [2, '09:00', '13:00', 40], [4, '09:00', '13:00', 40]],
            ],
            [
                'hospital_slug'   => 'ctg-medical',
                'dept'            => 'অর্থোপেডিক বিভাগ',
                'name'            => 'আবুল কালাম আজাদ',
                'title'           => 'অধ্যাপক ডাঃ',
                'qualifications'  => 'এমবিবিএস, এমএস (অর্থোপেডিক্স), এফআরসিএস',
                'specializations' => 'মেরুদণ্ড সার্জারি, হাঁটু প্রতিস্থাপন, স্পোর্টস ইনজুরি',
                'fee'             => 1100,
                'minutes'         => 20,
                'schedules'       => [[1, '10:00', '14:00', 20], [3, '10:00', '14:00', 20], [5, '10:00', '13:00', 15]],
            ],
            [
                'hospital_slug'   => 'ctg-medical',
                'dept'            => 'শিশু রোগ বিভাগ',
                'name'            => 'মাহমুদা বেগম',
                'title'           => 'ডাঃ',
                'qualifications'  => 'এমবিবিএস, এফসিপিএস (পেডিয়াট্রিক্স)',
                'specializations' => 'শিশুরোগ, পুষ্টি সমস্যা, অ্যাজমা',
                'fee'             => 500,
                'minutes'         => 15,
                'schedules'       => [[0, '08:00', '12:00', 35], [2, '08:00', '12:00', 35], [4, '08:00', '12:00', 35], [6, '09:00', '12:00', 25]],
            ],
        ];

        foreach ($doctors as $data) {
            $hId    = $hospitalIds[$data['hospital_slug']];
            $deptId = $deptIds[$hId][$data['dept']] ?? null;

            $doctor = Doctor::firstOrCreate(
                ['hospital_id' => $hId, 'name' => $data['name']],
                [
                    'department_id'            => $deptId,
                    'title'                    => $data['title'],
                    'qualifications'           => $data['qualifications'],
                    'specializations'          => $data['specializations'],
                    'consultation_fee'         => $data['fee'],
                    'avg_consultation_minutes' => $data['minutes'],
                    'is_active'                => true,
                ]
            );

            foreach ($data['schedules'] as [$day, $start, $end, $maxP]) {
                DoctorSchedule::firstOrCreate(
                    ['doctor_id' => $doctor->id, 'day_of_week' => $day],
                    ['start_time' => $start, 'end_time' => $end, 'max_patients' => $maxP, 'is_active' => true]
                );
            }

            $this->command->info("  Doctor: {$data['title']} {$data['name']}");
        }

        $this->command->info('Hospital seeding complete.');
    }
}
