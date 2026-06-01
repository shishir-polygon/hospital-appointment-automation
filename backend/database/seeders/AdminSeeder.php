<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Hospital;
use App\Models\Subscription;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    public function run(): void
    {
        $subscription = Subscription::firstOrCreate(
            ['name' => 'Free'],
            ['monthly_price' => 0, 'max_doctors' => 10, 'max_calls_per_month' => 500, 'is_active' => true]
        );

        $hospital = Hospital::firstOrCreate(
            ['slug' => 'demo-hospital'],
            [
                'name' => 'Demo Hospital',
                'address' => '123 Medical Center Road',
                'city' => 'Dhaka',
                'country' => 'BD',
                'phone' => '+8801700000000',
                'status' => 'active',
                'subscription_id' => $subscription->id,
            ]
        );

        User::firstOrCreate(
            ['email' => 'admin@hospital.com'],
            [
                'hospital_id' => null,
                'name' => 'Super Admin',
                'password' => Hash::make('password'),
                'role' => 'super_admin',
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );

        User::firstOrCreate(
            ['email' => 'hospitaladmin@demo.com'],
            [
                'hospital_id' => $hospital->id,
                'name' => 'Hospital Admin',
                'password' => Hash::make('password'),
                'role' => 'hospital_admin',
                'is_active' => true,
                'email_verified_at' => now(),
            ]
        );

        $this->command->info('Admin users seeded successfully.');
    }
}
